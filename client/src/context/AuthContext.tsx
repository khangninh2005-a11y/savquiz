import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { authApi } from '../api/authApi';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStaff: boolean;
  isStudent: boolean;
  loading: boolean;
  login: (username: string, passworde: string) => Promise<{ success: boolean; message: string }>;
  updateUser: (updatedData: Partial<User>) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('user_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('user_token');
      if (savedToken) {
        const isValid = await authApi.validateToken(savedToken);
        if (!isValid) {
          logout();
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (username: string, passworde: string) => {
    try {
      const res = await authApi.login(username, passworde);
      if (res.status === 'success' && res.data) {
        const userData = res.data;
        const userToken = userData.user_token || '';
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('user_token', userToken);
        localStorage.setItem('user_data', JSON.stringify(userData));
        return { success: true, message: res.message || 'Đăng nhập thành công' };
      }
      return { success: false, message: res.message || 'Tài khoản hoặc mật khẩu không chính xác' };
    } catch (err: any) {
      const serverMsg =
        typeof err?.response?.data === 'string'
          ? err.response.data
          : err?.response?.data?.message || err?.message;
      return { success: false, message: serverMsg || 'Không thể kết nối đến máy chủ' };
    }
  };

  const updateUser = (updatedData: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedData };
      localStorage.setItem('user_data', JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('quid');
    localStorage.removeItem('rid');
  };

  const accountTypeId = Number(user?.account_type_id);
  const isAdmin = accountTypeId === 1 || user?.account_name?.toLowerCase() === 'admin' || user?.access_permissions === 'all';
  const isTeacher = accountTypeId === 3 || user?.account_name?.toLowerCase() === 'teacher';
  const isStaff = isAdmin || isTeacher;
  const isStudent = !isStaff;

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    const perms = user.access_permissions?.split(',') || [];
    return perms.includes('all') || perms.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isAdmin,
        isTeacher,
        isStaff,
        isStudent,
        loading,
        login,
        updateUser,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
