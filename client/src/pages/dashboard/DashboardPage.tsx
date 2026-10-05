import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  BookOpen,
  Award,
  Users,
  PlusCircle,
  Play,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { quizApi } from '../../api/quizApi';
import { userApi } from '../../api/userApi';
import type { Quiz } from '../../types';

export const DashboardPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    questions: 0,
    quizzes: 0,
    results: 0,
    users: 0,
  });
  const [recentQuizzes, setRecentQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [quizRes, statRes] = await Promise.allSettled([
          isAdmin
            ? quizApi.getList({ limit: 0, maxRowsPerPage: 6 })
            : quizApi.getMyList({ limit: 0, maxRowsPerPage: 6 }),
          userApi.getDashboardStat(),
        ]);

        const quizzes =
          quizRes.status === 'fulfilled' && quizRes.value.status === 'success'
            ? quizRes.value.data || []
            : [];
        setRecentQuizzes(quizzes);

        if (statRes.status === 'fulfilled' && statRes.value.status === 'success' && statRes.value.data) {
          const s = statRes.value.data;
          setStats({
            questions: s.total_questions,
            quizzes: s.total_quizzes,
            results: s.total_results,
            users: s.total_users,
          });
        } else {
          // Fallback: count from quiz list
          setStats((prev) => ({ ...prev, quizzes: quizzes.length }));
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAdmin]);

  const statCards = [
    {
      title: 'Bài thi khả dụng',
      value: stats.quizzes,
      icon: BookOpen,
      color: 'from-blue-600 to-cyan-500',
      textColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/40',
      link: '/quizzes',
    },
    {
      title: 'Lượt thi & Kết quả',
      value: stats.results,
      icon: Award,
      color: 'from-emerald-600 to-teal-500',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      link: '/results',
    },
    ...(isAdmin
      ? [
          {
            title: 'Ngân hàng câu hỏi',
            value: stats.questions,
            icon: HelpCircle,
            color: 'from-violet-600 to-purple-500',
            textColor: 'text-violet-600 dark:text-violet-400',
            bgColor: 'bg-violet-50 dark:bg-violet-950/40',
            link: '/questions',
          },
          {
            title: 'Tổng người dùng',
            value: stats.users,
            icon: Users,
            color: 'from-amber-600 to-orange-500',
            textColor: 'text-amber-600 dark:text-amber-400',
            bgColor: 'bg-amber-50 dark:bg-amber-950/40',
            link: '/users',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 p-8 text-white shadow-xl shadow-indigo-500/15">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md mb-4">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Hệ thống Savquiz v2.0
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white m-0">
            Xin chào, {user?.full_name || user?.username}! 👋
          </h1>
          <p className="mt-2 text-indigo-100 text-sm sm:text-base leading-relaxed">
            Chào mừng bạn đến với hệ thống thi và đánh giá trực tuyến. Hãy lựa chọn bài kiểm tra hoặc quản lý ngân hàng đề thi của bạn.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/quizzes"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-indigo-600 shadow-md hover:bg-indigo-50 transition-all active:scale-98"
            >
              <Play className="h-4 w-4 fill-current" /> Danh sách bài thi
            </Link>
            {isAdmin && (
              <Link
                to="/questions"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-700/60 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md hover:bg-indigo-700 transition-all"
              >
                <PlusCircle className="h-4 w-4" /> Thêm câu hỏi mới
              </Link>
            )}
          </div>
        </div>

        {/* Decorative background shapes */}
        <div className="pointer-events-none absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute right-40 top-0 h-40 w-40 rounded-full bg-violet-400/20 blur-xl" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.link}
              className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-200/80 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:bg-slate-900 dark:border-slate-800"
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.bgColor} ${card.textColor}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  <span>Chi tiết</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {card.title}
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {loading ? '...' : card.value}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Quizzes Section */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Bài thi mới nhất
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Danh sách bài thi có thể tham gia ngay bây giờ
            </p>
          </div>
          <Link
            to="/quizzes"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 inline-flex items-center gap-1"
          >
            Xem tất cả <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Đang tải danh sách bài thi...</div>
        ) : recentQuizzes.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            Hiện chưa có bài thi nào được khởi tạo.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 transition-all hover:border-indigo-200 hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      MÃ ĐỀ #{quiz.id}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Clock className="h-3 w-3" /> {quiz.duration} phút
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                    {quiz.quiz_name}
                  </h4>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {quiz.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Điểm đạt: <strong className="text-emerald-600 dark:text-emerald-400">{quiz.min_pass_percentage}%</strong>
                  </span>
                  <Link
                    to={`/quiz/attempt/${quiz.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition-all"
                  >
                    <Play className="h-3 w-3 fill-current" /> Vào thi
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
