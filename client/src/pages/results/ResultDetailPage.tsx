import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Check,
  FileQuestion,
  Trash2,
  Volume2,
  ArrowRightLeft,
} from 'lucide-react';
import { resultApi } from '../../api/resultApi';
import apiClient from '../../api/client';
import { MathRenderer } from '../../components/Math/MathRenderer';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import { formatMediaUrl, isAudioMedia, parseMatchPair } from '../../utils/media';

export const ResultDetailPage: React.FC = () => {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [result, setResult] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!resultId) return;
      setLoading(true);
      setError('');
      try {
        // Fetch Result View Summary
        const res = await resultApi.view(resultId);
        if (res.status === 'success' && res.data) {
          setResult(res.data);

          // Fetch Questions & Responses breakdown
          const rData = res.data;
          const qRes = await apiClient.post('result/getQuestions', {
            rid: resultId,
            response_time: rData.response_time,
            ind_score: rData.ind_score,
            ind_time: rData.ind_time,
            attempted_questions: rData.qids_status,
            assigned_qids: rData.assigned_qids,
          });

          if (qRes.data && qRes.data.status === 'success') {
            setQuestions(qRes.data.data || []);
          }
        } else {
          setError(res.message || 'Không tìm thấy kết quả.');
        }
      } catch (err: any) {
        setError(err.message || 'Lỗi khi tải chi tiết kết quả.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [resultId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Đang tải bảng điểm chi tiết...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Không thể tải kết quả</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{error || 'Không tìm thấy dữ liệu.'}</p>
        <Link
          to="/results"
          className="mt-6 inline-flex rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
        >
          Quay lại danh sách kết quả
        </Link>
      </div>
    );
  }

  const handleDeleteResult = async () => {
    if (!resultId) return;
    setDeleteLoading(true);
    try {
      const res = await resultApi.remove(resultId);
      if (res && res.status === 'success') {
        navigate('/results');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteLoading(false);
      setIsDeleteOpen(false);
    }
  };

  const isPass = result.result_status === 'Pass';

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/results"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách kết quả
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-slate-400">
            MÃ KẾT QUẢ #{result.id}
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa kết quả này
            </button>
          )}
        </div>
      </div>

      {/* Summary Scorecard */}
      <div
        className={`relative overflow-hidden rounded-3xl p-8 border shadow-xl ${
          isPass
            ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-500/30 shadow-emerald-500/10'
            : 'bg-gradient-to-br from-rose-600 to-red-700 text-white border-rose-500/30 shadow-rose-500/10'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md mb-3">
              {isPass ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {isPass ? 'KẾT QUẢ: ĐẠT' : 'KẾT QUẢ: CHƯA ĐẠT'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white m-0">
              {result.quiz_name}
            </h1>
            <p className="mt-2 text-sm opacity-90">
              Thí sinh: <strong>{result.full_name || result.username}</strong>
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/20 text-center sm:text-right">
            <div>
              <span className="text-xs font-semibold opacity-80 block">Điểm đạt được</span>
              <div className="flex items-baseline justify-center sm:justify-end gap-1">
                <span className="text-3xl font-black">{result.obtained_score}</span>
                <span className="text-base font-bold opacity-80"> / {result.max_score}</span>
              </div>
              <span className="text-xs font-medium opacity-90 block mt-0.5">
                (Thang 10: {result.score_10} / 10)
              </span>
            </div>
            <div className="h-12 w-px bg-white/20" />
            <div>
              <span className="text-xs font-semibold opacity-80 block">Tỷ lệ</span>
              <span className="text-3xl font-black">{result.obtained_percentage}%</span>
              <span className="text-xs font-medium opacity-90 block mt-0.5">
                {isPass ? 'Đạt chuẩn' : 'Chưa đạt'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats row */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-5 gap-3 pt-6 border-t border-white/20 text-center">
          <div>
            <span className="text-xs opacity-80 block">Tổng số câu</span>
            <strong className="text-lg font-bold">{result.total_questions ?? questions.length}</strong>
          </div>
          <div>
            <span className="text-xs opacity-80 block">Số câu đúng</span>
            <strong className="text-lg font-bold text-emerald-200">{result.no_corrected ?? 0}</strong>
          </div>
          <div>
            <span className="text-xs opacity-80 block">Số câu sai</span>
            <strong className="text-lg font-bold text-rose-200">{result.no_incorrected ?? 0}</strong>
          </div>
          <div>
            <span className="text-xs opacity-80 block">Chưa làm</span>
            <strong className="text-lg font-bold opacity-90">{result.no_unanswered ?? 0}</strong>
          </div>
          <div>
            <span className="text-xs opacity-80 block">Thời gian làm bài</span>
            <strong className="text-lg font-bold">{result.time_spent_in_min || `${Math.round((result.time_spent || 0) / 60)} phút`}</strong>
          </div>
        </div>
      </div>

      {/* Question by Question Review */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileQuestion className="h-5 w-5 text-indigo-600" />
          Chi tiết từng câu hỏi & bài làm
        </h3>

        {questions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-400">
            Không có thông tin chi tiết từng câu.
          </div>
        ) : (
          questions.map((item, idx) => {
            const userResp = item.user_response;
            const q = item.question || {};
            const options = item.options || [];
            const maxScore = Number(item.max_score) || 1;
            const obtainedScore = item.score_obtained !== undefined && item.score_obtained !== null
              ? Number(item.score_obtained)
              : null;

            // Parse all chosen options / answers from userResp
            const chosenSet = new Set<string>();
            const isShortAnswer = q.question_type === 'Short Answer';
            const isMultipleChoice = q.question_type === 'Multiple Choice Multiple Answers';

            if (userResp !== undefined && userResp !== null && userResp !== '') {
              if (Array.isArray(userResp)) {
                userResp.forEach((v) => chosenSet.add(String(v).trim()));
              } else {
                const str = String(userResp).trim();
                if (str.startsWith('[') && str.endsWith(']')) {
                  try {
                    const parsed = JSON.parse(str);
                    if (Array.isArray(parsed)) {
                      parsed.forEach((v) => chosenSet.add(String(v).trim()));
                    }
                  } catch {}
                }
                str.split(',').forEach((s) => {
                  const t = s.trim().replace(/^['"]|['"]$/g, '');
                  if (t) chosenSet.add(t);
                });
              }
            }

            const rawRespStr = String(userResp || '').replace(/^\[['"]?|['"]?\]$/g, '').trim();
            const isAnswered = chosenSet.size > 0 || (rawRespStr.length > 0 && rawRespStr !== '[]');

            // Determine if question is correct / partial / incorrect
            let isCorrectQuestion = false;
            let isPartialQuestion = false;

            if (obtainedScore !== null) {
              if (obtainedScore >= maxScore && maxScore > 0) {
                isCorrectQuestion = true;
              } else if (obtainedScore > 0 && obtainedScore < maxScore) {
                isPartialQuestion = true;
              }
            } else {
              const correctOpts = options.filter((o: any) => Number(o.score) > 0);
              if (isShortAnswer) {
                const correctAnswers = options.flatMap((o: any) =>
                  (o.question_option || '').split(',')
                ).map((s: string) => s.trim().toLowerCase()).filter(Boolean);
                isCorrectQuestion = Boolean(userResp && correctAnswers.includes(String(userResp).trim().toLowerCase()));
              } else if (isMultipleChoice) {
                const correctIds = correctOpts.map((o: any) => String(o.id));
                const userChoseAllCorrect = correctIds.length > 0 && correctIds.every((id: string) => chosenSet.has(id));
                const userChoseNoIncorrect = Array.from(chosenSet).every((id: string) => correctIds.includes(id));
                isCorrectQuestion = userChoseAllCorrect && userChoseNoIncorrect;
              } else {
                // Single Choice or True / False
                const correctIds = correctOpts.map((o: any) => String(o.id));
                const correctTexts = correctOpts.map((o: any) => (o.question_option || '').trim().toLowerCase());
                const respLower = rawRespStr.toLowerCase();
                isCorrectQuestion = correctIds.includes(rawRespStr) || correctTexts.includes(respLower);
              }
            }

            return (
              <div
                key={idx}
                className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-2 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      CÂU HỎI #{idx + 1}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {q.question_type}
                    </span>
                    {q.difficulty_level && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          q.difficulty_level === 'Nhận biết'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : q.difficulty_level === 'Thông hiểu'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : q.difficulty_level === 'Vận dụng'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {q.difficulty_level}
                      </span>
                    )}
                  </div>

                  {/* Question Result Badge & Score */}
                  <div className="flex items-center gap-2">
                    {isCorrectQuestion ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-bold">
                        <CheckCircle className="h-3.5 w-3.5" /> Đúng
                      </span>
                    ) : isPartialQuestion ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 px-2.5 py-0.5 text-xs font-bold">
                        <AlertCircle className="h-3.5 w-3.5" /> Đúng một phần
                      </span>
                    ) : isAnswered ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 px-2.5 py-0.5 text-xs font-bold">
                        <XCircle className="h-3.5 w-3.5" /> Sai
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-0.5 text-xs font-medium">
                        Chưa trả lời
                      </span>
                    )}

                    {item.score_obtained !== undefined && item.score_obtained !== null && (
                      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                        item.score_obtained > 0 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                          : item.score_obtained < 0 
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' 
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {item.score_obtained > 0 ? `+${item.score_obtained}` : item.score_obtained} / {item.max_score} điểm
                      </span>
                    )}
                  </div>
                </div>

                {/* Media: Audio or Image */}
                {q.media_url && (
                  <div className="my-2">
                    {isAudioMedia(q.media_url, q.media_type) ? (
                      <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          <Volume2 className="h-4 w-4" />
                          <span>Tài liệu nghe:</span>
                        </div>
                        <audio
                          controls
                          src={formatMediaUrl(q.media_url)}
                          className="w-full h-10"
                        />
                      </div>
                    ) : (
                      <div className="flex justify-center p-3 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
                        <img
                          src={formatMediaUrl(q.media_url)}
                          alt="Hình ảnh câu hỏi"
                          className="max-h-72 object-contain rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Question text */}
                <div className="text-base font-semibold text-slate-900 dark:text-white">
                  <MathRenderer content={q.question} />
                </div>

                {/* Question Content: Options or Short Answer or Match */}
                {(() => {
                  const isMatchQ =
                    q.question_type === 'Match / Ordering' ||
                    String(q.question_type) === '5' ||
                    String(q.question_type).toLowerCase().includes('match') ||
                    String(q.question_type).toLowerCase().includes('nối');

                  if (isMatchQ) {
                    const pairs = options.map((opt: any) => parseMatchPair(opt.question_option));
                    let userMatchMap: Record<string, string> = {};
                    if (rawRespStr) {
                      if (rawRespStr.startsWith('{') && rawRespStr.endsWith('}')) {
                        try {
                          userMatchMap = JSON.parse(rawRespStr);
                        } catch {}
                      } else {
                        rawRespStr.split(',').forEach((item: string) => {
                          const sep = item.includes(':::') ? ':::' : item.includes('===') ? '===' : '->';
                          const parts = item.split(sep);
                          if (parts.length >= 2) {
                            userMatchMap[parts[0].trim()] = parts[1].trim();
                          }
                        });
                      }
                    }

                    return (
                      <div className="space-y-3 pt-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Đối chiếu kết quả ghép nối ({pairs.length} cặp):
                        </div>
                        <div className="space-y-2.5">
                          {pairs.map((pair: any, pIdx: number) => {
                            const userChosen = userMatchMap[pair.left] || '';
                            const isPairCorrect = userChosen && userChosen.toLowerCase() === pair.right.toLowerCase();

                            return (
                              <div
                                key={pIdx}
                                className={`rounded-xl border p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs transition-all ${
                                  isPairCorrect
                                    ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                                    : userChosen
                                    ? 'border-rose-300 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                                    : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40'
                                }`}
                              >
                                <div className="flex items-center gap-2 sm:w-2/5">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-[10px]">
                                    {pIdx + 1}
                                  </span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {pair.left}
                                  </span>
                                </div>

                                <div className="hidden sm:flex items-center text-slate-400">
                                  <ArrowRightLeft className="h-4 w-4" />
                                </div>

                                <div className="flex-1 sm:w-2/5 flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400">Bạn chọn:</span>
                                    <span
                                      className={`font-bold ${
                                        isPairCorrect
                                          ? 'text-emerald-700 dark:text-emerald-400'
                                          : userChosen
                                          ? 'text-rose-600 dark:text-rose-400 line-through'
                                          : 'text-slate-400 italic'
                                      }`}
                                    >
                                      {userChosen || '(Bỏ trống)'}
                                    </span>
                                  </div>
                                  {!isPairCorrect && (
                                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                                      <span>Đáp án đúng:</span>
                                      <span>{pair.right}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (isShortAnswer) {
                    return (
                      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm space-y-3">
                        <div>
                          <span className="text-xs text-slate-400 block mb-1">Câu trả lời của bạn:</span>
                          <p className={`font-semibold ${isCorrectQuestion ? 'text-emerald-700 dark:text-emerald-400' : isAnswered ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400 italic'}`}>
                            {userResp ? String(userResp) : '(Chưa trả lời)'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 block mb-1">Đáp án đúng / được chấp nhận:</span>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {options.map((o: any) => o.question_option).join(' hoặc ')}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (options.length > 0) {
                    return (
                      <div className="space-y-2 pt-2">
                    {options.map((opt: any, optIdx: number) => {
                      const isCorrect = Number(opt.score) > 0;
                      const optText = String(opt.question_option || '').trim().toLowerCase();
                      const isChosen =
                        chosenSet.has(String(opt.id)) ||
                        (opt.question_option && chosenSet.has(String(opt.question_option).trim())) ||
                        (rawRespStr && String(opt.id) === rawRespStr) ||
                        (rawRespStr && optText === rawRespStr.toLowerCase());

                      let style =
                        'border-slate-200 bg-slate-50/50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300';
                      if (isCorrect && isChosen) {
                        style =
                          'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 ring-2 ring-emerald-500/20';
                      } else if (isCorrect && !isChosen) {
                        style =
                          'border-emerald-400/80 bg-emerald-50/40 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300';
                      } else if (!isCorrect && isChosen) {
                        style =
                          'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200 ring-2 ring-rose-500/20';
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`flex items-start gap-3 rounded-2xl p-3.5 border transition-all ${style}`}
                        >
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : isChosen
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </div>

                          <div className="flex-1 text-sm">
                            <MathRenderer content={opt.question_option} />
                          </div>

                          <div className="flex items-center gap-2">
                            {isChosen && (
                              <span
                                className={`rounded-md px-2 py-0.5 text-xs font-bold text-white shadow-xs ${
                                  isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                              >
                                {isCorrect ? 'Bạn đã chọn (Đúng)' : 'Bạn đã chọn (Sai)'}
                              </span>
                            )}
                            {isCorrect && !isChosen && (
                              <span className="flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-bold">
                                <Check className="h-3 w-3" /> Đáp án đúng
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm space-y-2">
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Câu trả lời của bạn:</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {userResp ? String(userResp) : <span className="text-slate-400 italic">(Chưa trả lời)</span>}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteResult}
        loading={deleteLoading}
        message="Bạn có chắc chắn muốn xóa bản ghi kết quả này? Hành động này sẽ chuyển kết quả vào thùng rác."
      />
    </div>
  );
};
