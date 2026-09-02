import { Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from '../hooks/useAuth.jsx';
import Sidebar from '../components/Sidebar.jsx';
import AppErrorBoundary from '../components/AppErrorBoundary.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import LoginPage from '../features/auth/LoginPage.jsx';
import { routes } from './router.jsx';

function AuthedShell() {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;

    function closeOnEscape(event) {
      if (event.key === 'Escape') setMobileNavOpen(false);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavOpen]);

  return (
    <div className="dashboard" style={{ display: 'flex' }}>
      <header className="mobile-topbar">
        <div className="mobile-topbar-brand">Guardian Group</div>
        <button
          type="button"
          className="mobile-menu-button"
          aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-controls="admin-navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>
      <button
        type="button"
        className={`mobile-nav-scrim${mobileNavOpen ? ' visible' : ''}`}
        aria-label="Close navigation menu"
        tabIndex={mobileNavOpen ? 0 : -1}
        onClick={() => setMobileNavOpen(false)}
      />
      <Sidebar isOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
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
