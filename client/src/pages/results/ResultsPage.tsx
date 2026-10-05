import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Calendar,
} from 'lucide-react';
import { resultApi } from '../../api/resultApi';
import type { Result } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import { Pagination } from '../../components/Common/Pagination';

export const ResultsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = isAdmin
        ? await resultApi.getList({ limit: page * pageSize, maxRowsPerPage: pageSize, search })
        : await resultApi.getMyList({ limit: page * pageSize, maxRowsPerPage: pageSize, search });
      if (res.status === 'success' && res.data) {
        setResults(res.data);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [page, search, isAdmin]);

  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await resultApi.remove(deleteId);
      if (res && res.status === 'success') {
        setDeleteId(null);
        fetchResults();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 m-0">
            <Award className="h-7 w-7 text-indigo-600" />
            Bảng Kết quả & Lịch sử làm bài
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi điểm số, tỷ lệ đạt và xem lại bài làm chi tiết
          </p>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Tìm theo tên bài thi, thí sinh..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50/75 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:bg-slate-950/50 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Mã kết quả</th>
                <th className="px-6 py-3.5">Tên bài thi</th>
                {isAdmin && <th className="px-6 py-3.5">Thí sinh</th>}
                <th className="px-6 py-3.5">Điểm số</th>
                <th className="px-6 py-3.5">Tỷ lệ (%)</th>
                <th className="px-6 py-3.5">Trạng thái</th>
                <th className="px-6 py-3.5">Thời gian nộp</th>
                <th className="px-6 py-3.5 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-12 text-center text-slate-400">
                    Đang tải kết quả...
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-12 text-center text-slate-400">
                    Không có kết quả nào.
                  </td>
                </tr>
              ) : (
                results.map((r) => {
                  const isPass = r.result_status === 'Pass';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">
                        #{r.id}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {r.quiz_name || `Quiz #${r.quid}`}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {r.full_name || r.username}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">{r.email}</div>
                        </td>
                      )}
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                        <div className="flex items-baseline gap-1">
                          <span>{r.obtained_score}</span>
                          <span className="text-xs font-normal text-slate-400">/ {r.max_score ?? '-'}</span>
                        </div>
                        {r.score_10 !== undefined && (
                          <div className="text-xs font-normal text-indigo-600 dark:text-indigo-400">
                            Thang 10: {r.score_10}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold">
                        <span className={isPass ? 'text-emerald-600' : 'text-rose-600'}>
                          {r.obtained_percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
                            isPass
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          }`}
                        >
                          {isPass ? (
                            <>
                              <CheckCircle className="h-3.5 w-3.5" /> Đạt (Pass)
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" /> Chưa đạt (Fail)
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {r.attempted_datetime
                            ? new Date(r.attempted_datetime * 1000).toLocaleDateString('vi-VN')
                            : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/results/detail/${r.id}`}
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            <Eye className="h-3.5 w-3.5" /> Xem lại
                          </Link>
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteId(r.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                              title="Xóa kết quả"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          hasMore={results.length >= pageSize}
        />
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        message="Bạn có chắc chắn muốn xóa bản ghi kết quả này?"
      />
    </div>
  );
};
