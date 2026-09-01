import { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../hooks/useAuth.jsx';
import Sidebar from '../components/Sidebar.jsx';
import AppErrorBoundary from '../components/AppErrorBoundary.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import LoginPage from '../features/auth/LoginPage.jsx';
import { routes } from './router.jsx';

function AuthedShell() {
  const location = useLocation();

  return (
    <div className="dashboard" style={{ display: 'flex' }}>
      <Sidebar />
      <main className="dash-main">
        <AppErrorBoundary key={location.pathname}>
          <Suspense fallback={<LoadingIndicator />}>
            <Routes>
              <Route path="/" element={<Navigate to="/admin" replace />} />
              {routes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </AppErrorBoundary>
      </main>
    </div>
  );
}

function Gate() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <LoadingIndicator label="Loading admin dashboard…" />;
  return isAuthenticated ? <AuthedShell /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
