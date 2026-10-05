import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/Layout/AppLayout';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { UsersPage } from './pages/users/UsersPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { GroupsPage } from './pages/groups/GroupsPage';
import { QuestionBankPage } from './pages/questions/QuestionBankPage';
import { QuestionTypesPage } from './pages/questions/QuestionTypesPage';
import { QuizListPage } from './pages/quizzes/QuizListPage';
import { QuizAttemptPage } from './pages/quizzes/QuizAttemptPage';
import { ResultsPage } from './pages/results/ResultsPage';
import { ResultDetailPage } from './pages/results/ResultDetailPage';

// Protected Route Guard
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireStaff?: boolean;
}> = ({
  children,
  requireAdmin = false,
  requireStaff = false,
}) => {
  const { isAuthenticated, isAdmin, isStaff, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireStaff && !isStaff) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Public Route Guard (Redirect if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            }
          />

          {/* Protected App Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route
              path="questions"
              element={
                <ProtectedRoute requireStaff={true}>
                  <QuestionBankPage />
                </ProtectedRoute>
              }
            />
            <Route path="quizzes" element={<QuizListPage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route path="results/detail/:resultId" element={<ResultDetailPage />} />

            {/* Staff / Teacher & Admin routes */}
            <Route
              path="categories"
              element={
                <ProtectedRoute requireStaff={true}>
                  <CategoriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="question-types"
              element={
                <ProtectedRoute requireStaff={true}>
                  <QuestionTypesPage />
                </ProtectedRoute>
              }
            />

            {/* Super Admin only routes */}
            <Route
              path="users"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="groups"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <GroupsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Exam Taking Screen (Standalone Fullscreen Layout) */}
          <Route
            path="/quiz/attempt/:quizId"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 dark:bg-slate-950">
                  <div className="max-w-7xl mx-auto">
                    <QuizAttemptPage />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />

          {/* Catch-all route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
