import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  HelpCircle,
  BookOpen,
  Award,
  Users,
  FolderTree,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Sun,
  Moon,
  Shield,
  Layers,
  ListChecks,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Common/Modal';
import { userApi } from '../../api/userApi';

export const AppLayout: React.FC = () => {
  const { user, updateUser, logout, isAdmin, isTeacher, isStaff } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Profile modal states
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileFullName, setProfileFullName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const handleOpenProfile = () => {
    setProfileFullName(user?.full_name || '');
    setProfileEmail(user?.email || '');
    setProfileNewPassword('');
    setProfileMsg('');
    setProfileErr('');
    setIsProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setProfileSaving(true);
    try {
      if (user?.id) {
        const res = await userApi.editUser(user.id, {
          username: user.username,
          email: profileEmail.trim(),
          full_name: profileFullName.trim(),
          passworde: profileNewPassword || undefined,
          account_type_id: user.account_type_id,
          group_ids: user.group_ids || '1',
        });

        if (res.status === 'success') {
          updateUser({
            full_name: profileFullName.trim(),
            email: profileEmail.trim(),
          });
          setProfileMsg('Cập nhật Họ và tên thành công!');
          setTimeout(() => {
            setIsProfileOpen(false);
          }, 1200);
        } else {
          setProfileErr(res.message || 'Không thể cập nhật thông tin');
        }
      }
    } catch (err: any) {
      setProfileErr(err?.response?.data?.message || err?.message || 'Lỗi khi cập nhật thông tin');
    } finally {
      setProfileSaving(false);
    }
  };

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      name: 'Trang chủ',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['all'],
    },
    {
      name: 'Ngân hàng câu hỏi',
      path: '/questions',
      icon: HelpCircle,
      roles: ['staff'],
    },
    {
      name: 'Quản lý bài thi',
      path: '/quizzes',
      icon: BookOpen,
      roles: ['all'],
    },
    {
      name: 'Bảng kết quả',
      path: '/results',
      icon: Award,
      roles: ['all'],
    },
    {
      name: 'Danh mục câu hỏi',
      path: '/categories',
      icon: FolderTree,
      roles: ['staff'],
    },
    {
      name: 'Loại câu hỏi',
      path: '/question-types',
      icon: ListChecks,
      roles: ['staff'],
    },
    {
      name: 'Quản lý người dùng',
      path: '/users',
      icon: Users,
      roles: ['admin'],
    },
    {
      name: 'Nhóm người dùng',
      path: '/groups',
      icon: Layers,
      roles: ['admin'],
    },
  ];

  const filteredNav = navItems.filter((item) => {
    if (item.roles.includes('all')) return true;
    if (item.roles.includes('admin') && isAdmin) return true;
    if (item.roles.includes('staff') && isStaff) return true;
    return false;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md sm:px-6 dark:border-slate-800/80 dark:bg-slate-900/80">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
                SAVQUIZ
              </span>
              <span className="hidden sm:inline-block ml-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                PRO
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            title="Đổi giao diện Sáng / Tối"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-3 border-l border-slate-200 pl-3 dark:border-slate-800">
            <button
              onClick={handleOpenProfile}
              title="Xem và chỉnh sửa Họ và tên, hồ sơ cá nhân"
              className="flex items-center gap-3 rounded-xl p-1 -m-1 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left group"
            >
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {user?.full_name || user?.username}
                </span>
                <div className="flex items-center justify-end gap-1">
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <Shield className="h-3 w-3" /> Quản trị viên
                    </span>
                  ) : isTeacher ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      <GraduationCap className="h-3 w-3" /> Giảng viên
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {user?.group_name || 'Học viên'}
                    </span>
                  )}
                </div>
              </div>

              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                {(user?.username || 'U').charAt(0).toUpperCase()}
              </div>
            </button>

            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="rounded-xl p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200/80 bg-white/50 p-4 backdrop-blur-xs dark:border-slate-800/80 dark:bg-slate-900/50">
          <div className="space-y-1">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 dark:bg-indigo-500'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 p-3 dark:from-indigo-950/40 dark:to-violet-950/40 border border-indigo-100/50 dark:border-indigo-900/40">
              <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                Savquiz v2.0
              </p>
              <p className="text-xs text-indigo-700/70 dark:text-indigo-300/70 mt-0.5">
                Hệ thống thi & đánh giá trực tuyến
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-72 bg-white p-4 shadow-2xl dark:bg-slate-900 flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-lg text-indigo-600">Menu điều hướng</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 space-y-1 flex-1">
                {filteredNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Profile Modal */}
      <Modal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title="Thông tin tài khoản"
        maxWidth="md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {profileMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{profileMsg}</span>
            </div>
          )}

          {profileErr && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-100 dark:border-rose-900/50">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{profileErr}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Họ và Tên
            </label>
            <input
              type="text"
              required
              value={profileFullName}
              onChange={(e) => setProfileFullName(e.target.value)}
              placeholder="Nhập họ và tên..."
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
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Tên đăng nhập
            </label>
            <input
              type="text"
              disabled
              value={user?.username || ''}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 px-3 text-sm text-slate-500 cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
              Mật khẩu mới <span className="text-slate-400 font-normal normal-case">(để trống nếu không muốn đổi)</span>
            </label>
            <input
              type="password"
              value={profileNewPassword}
              onChange={(e) => setProfileNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsProfileOpen(false)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50"
            >
              {profileSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
