import React, { useState, useEffect } from 'react';
import { ListChecks, Search, Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { qbankApi } from '../../api/qbankApi';
import { Modal } from '../../components/Common/Modal';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import type { QuestionTypeItem } from '../../types';

export const QuestionTypesPage: React.FC = () => {
  const [types, setTypes] = useState<QuestionTypeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Add Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ type_name: '', description: '' });
  const [addError, setAddError] = useState('');
  const [savingAdd, setSavingAdd] = useState(false);

  // Edit Modal
  const [editItem, setEditItem] = useState<QuestionTypeItem | null>(null);
  const [editForm, setEditForm] = useState({ type_name: '', description: '' });
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await qbankApi.getQuestionTypeList();
      if (res.status === 'success' && res.data) {
        setTypes(res.data);
      } else {
        setTypes([]);
      }
    } catch {
      setTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const filtered = types.filter((t) => {
    const q = search.toLowerCase();
    return (
      String(t.id).includes(q) ||
      t.type_name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  });

  const handleOpenAdd = () => {
    setAddForm({ type_name: '', description: '' });
    setAddError('');
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = addForm.type_name.trim();

    if (!name) {
      setAddError('Vui lòng nhập Tên loại câu hỏi.');
      return;
    }

    setSavingAdd(true);
    setAddError('');
    try {
      const res = await qbankApi.addQuestionType({
        type_code: '',
        type_name: name,
        description: addForm.description.trim(),
      });
      if (res.status === 'success') {
        setIsAddOpen(false);
        fetchTypes();
      } else {
        setAddError(res.message || 'Không thể tạo loại câu hỏi mới.');
      }
    } catch (err: any) {
      setAddError(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setSavingAdd(false);
    }
  };

  const handleOpenEdit = (item: QuestionTypeItem) => {
    setEditItem(item);
    setEditForm({
      type_name: item.type_name,
      description: item.description || '',
    });
    setEditError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    const name = editForm.type_name.trim();
    if (!name) {
      setEditError('Tên loại câu hỏi không được để trống.');
      return;
    }

    setSavingEdit(true);
    setEditError('');
    try {
      const res = await qbankApi.updateQuestionType({
        id: editItem.id,
        type_name: name,
        description: editForm.description.trim(),
      });
      if (res.status === 'success') {
        setEditItem(null);
        fetchTypes();
      } else {
        setEditError(res.message || 'Không thể cập nhật loại câu hỏi.');
      }
    } catch (err: any) {
      setEditError(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await qbankApi.deleteQuestionType(deleteId);
      if (res.status === 'success') {
        setDeleteId(null);
        fetchTypes();
      } else {
        alert(res.message || 'Không thể xóa loại câu hỏi này.');
        setDeleteId(null);
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi xóa loại câu hỏi.');
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 m-0">
            <ListChecks className="h-7 w-7 text-indigo-600" />
            Loại Câu hỏi
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quản lý tên gọi hiển thị và danh sách các định dạng câu hỏi hỗ trợ trong hệ thống
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Thêm loại câu hỏi
        </button>
      </div>

      {/* Main Table Card */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo ID hoặc tên loại câu hỏi..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Tổng cộng: <strong className="text-indigo-600 dark:text-indigo-400">{filtered.length}</strong> loại
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50/75 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:bg-slate-950/50 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5 w-24">ID</th>
                <th className="px-6 py-3.5">Tên gọi loại câu hỏi</th>
                <th className="px-6 py-3.5">Mô tả / Hướng dẫn</th>
                <th className="px-6 py-3.5 text-right w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                    Đang nạp dữ liệu loại câu hỏi...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                    Không tìm thấy loại câu hỏi nào phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                      #{item.id}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      <span className="inline-flex rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {item.type_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 max-w-md">
                      {item.description || <span className="italic text-slate-300 dark:text-slate-600">Chưa có mô tả</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Sửa tên gọi / mô tả"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                          title="Xóa loại câu hỏi"
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
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Thêm loại câu hỏi mới"
        maxWidth="lg"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {addError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
              Tên loại câu hỏi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={addForm.type_name}
              onChange={(e) => setAddForm({ ...addForm, type_name: e.target.value })}
              placeholder="VD: Trắc nghiệm một đáp án"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
              Mô tả / Hướng dẫn
            </label>
            <textarea
              rows={3}
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              placeholder="Mô tả quy cách làm bài của loại câu hỏi này..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingAdd}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              {savingAdd ? 'Đang lưu...' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editItem !== null}
        onClose={() => setEditItem(null)}
        title="Chỉnh sửa Loại câu hỏi"
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-400">ID loại câu hỏi:</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">#{editItem?.id}</span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
              Tên loại câu hỏi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editForm.type_name}
              onChange={(e) => setEditForm({ ...editForm, type_name: e.target.value })}
              placeholder="VD: Trắc nghiệm một đáp án"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5">
              Mô tả / Hướng dẫn
            </label>
            <textarea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder="Mô tả quy cách làm bài của loại câu hỏi này..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditItem(null)}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Bạn có chắc chắn muốn xóa loại câu hỏi này? Lưu ý: Không thể xóa nếu đang có câu hỏi thuộc loại này trong hệ thống."
      />
    </div>
  );
};
