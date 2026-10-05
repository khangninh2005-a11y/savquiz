import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit2,
  Shield,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { userApi } from '../../api/userApi';
import type { User, Group, AccountType } from '../../types';
import { Modal } from '../../components/Common/Modal';
import { ConfirmModal } from '../../components/Common/ConfirmModal';
import { Pagination } from '../../components/Common/Pagination';
import { useAuth } from '../../context/AuthContext';

export const UsersPage: React.FC = () => {
  const { user: currentUser, updateUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 15;

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    passworde: '',
    account_type_id: 2,
    group_ids: '1',
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userApi.getList({
        limit: page * pageSize,
        maxRowsPerPage: pageSize,
        search,
      });
      if (res.status === 'success' && res.data) {
        setUsers(res.data);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [grpRes, accRes] = await Promise.allSettled([
        userApi.getGroupList(),
        userApi.getAccountTypeList(),
      ]);
      if (grpRes.status === 'fulfilled' && grpRes.value.data) {
        setGroups(grpRes.value.data);
      }
      if (accRes.status === 'fulfilled' && accRes.value.data) {
        setAccountTypes(accRes.value.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const handleOpenAdd = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      passworde: '',
      account_type_id: accountTypes[0]?.id || 2,
      group_ids: String(groups[0]?.id || '1'),
    });
    setFormError('');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setSelectedUser(u);
    setFormData({
      username: u.username,
      email: u.email,
      full_name: u.full_name,
      passworde: '',
      account_type_id: u.account_type_id,
      group_ids: u.group_ids || '1',
    });
    setFormError('');
    setIsEditOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const res = await userApi.addUser(formData);
      if (res.status === 'success') {
        setIsAddOpen(false);
        fetchUsers();
      } else {
        setFormError(res.message || 'Không thể tạo tài khoản');
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi kết nối máy chủ');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError('');
    try {
      const res = await userApi.editUser(selectedUser.id, formData);
      if (res.status === 'success') {
        setIsEditOpen(false);
        if (currentUser && currentUser.id === selectedUser.id) {
          updateUser({
            full_name: formData.full_name,
            email: formData.email,
          });
        }
        fetchUsers();
      } else {
        setFormError(res.message || 'Không thể cập nhật tài khoản');
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi kết nối máy chủ');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await userApi.remove(deleteId);
      setDeleteId(null);
      fetchUsers();
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
            <Users className="h-7 w-7 text-indigo-600" />
            Quản lý Người dùng
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Danh sách tài khoản, nhóm thành viên và phân quyền truy cập
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-all"
        >
          <Plus className="h-4 w-4" /> Thêm người dùng
        </button>
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
              placeholder="Tìm theo tên, email, username..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50/75 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:bg-slate-950/50 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5">ID</th>
                <th className="px-6 py-3.5">Họ và Tên / Username</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Nhóm</th>
                <th className="px-6 py-3.5">Vai trò</th>
                <th className="px-6 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Không tìm thấy người dùng phù hợp.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">
                      #{u.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {u.full_name || u.username}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">@{u.username}</div>
                    </td>
                    <td className="px-6 py-4">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        <Layers className="h-3 w-3" /> {u.group_name || `Group ${u.group_ids}`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          u.account_type_id === 1
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <Shield className="h-3 w-3" /> {u.account_name || (u.account_type_id === 1 ? 'Admin' : 'User')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteId(u.id)}
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
          hasMore={users.length >= pageSize}
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isAddOpen || isEditOpen}
        onClose={() => {
          setIsAddOpen(false);
          setIsEditOpen(false);
        }}
        title={isAddOpen ? 'Thêm người dùng mới' : 'Chỉnh sửa người dùng'}
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
              Họ và Tên
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Tên đăng nhập (Username)
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Mật khẩu {isEditOpen && <span className="text-slate-400 font-normal normal-case">(để trống nếu không đổi)</span>}
            </label>
            <input
              type="password"
              required={isAddOpen}
              value={formData.passworde}
              onChange={(e) => setFormData({ ...formData, passworde: e.target.value })}
              placeholder={isEditOpen ? '••••••••' : 'Nhập mật khẩu...'}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Nhóm người dùng
              </label>
              <select
                value={formData.group_ids}
                onChange={(e) => setFormData({ ...formData, group_ids: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.group_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Vai trò (Role)
              </label>
              <select
                value={formData.account_type_id}
                onChange={(e) => setFormData({ ...formData, account_type_id: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                {accountTypes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
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
              {isAddOpen ? 'Tạo tài khoản' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Bạn có chắc chắn muốn xóa tài khoản này? Hành động này sẽ chuyển tài khoản vào thùng rác."
      />
    </div>
  );
};
