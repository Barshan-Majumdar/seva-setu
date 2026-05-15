import { lazy, Suspense, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import Logo from './components/Logo';
import ProtectedRoute from './components/ProtectedRoute';
import AuthTokenBridge from './components/AuthTokenBridge';
import RoleSync from './components/RoleSync';
import ChatWidget from './components/ChatWidget';
import { useAuth } from './hooks/useAuth';

// Lazy load all pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const PostLoginRedirect = lazy(() => import('./pages/PostLoginRedirect'));
const VolunteerPage = lazy(() => import('./pages/VolunteerPage'));
const FieldForm = lazy(() => import('./pages/FieldForm'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const NeedsArchivePage = lazy(() => import('./pages/NeedsArchivePage'));
const MyReportsPage = lazy(() => import('./pages/MyReportsPage'));
const UserDashboardPage = lazy(() => import('./pages/UserDashboardPage'));
const VolunteerApprovalsPage = lazy(() => import('./pages/VolunteerApprovalsPage'));

const PageLoader = ({ text = 'Synchronizing' }) => (
  <div className="page-loader">
    <div className="page-loader-inner">
      <Logo size={64} className="pulse" />
      <div className="page-loader-status">
        <Loader2 className="icon-spin" style={{ width: 16, height: 16 }} />
        <span className="page-loader-text">{text}</span>
      </div>
    </div>
  </div>
);

/**
 * MainContent — rendered INSIDE Router so all hooks have full context.
 * This is the fix for "dispatcher is null" in React 19 + Clerk + react-router.
 * Hooks (useAuth, useNavigate, etc.) must be called after providers are mounted.
 */
function MainContent() {
  const { isAuthenticated } = useAuth();
  const [isReady, setIsReady] = useState(false);

  const handleSyncReady = useCallback(() => {
    setIsReady(true);
  }, []);

  return (
    <>
      <AuthTokenBridge />
      <RoleSync onReady={handleSyncReady} />

      {!isReady ? (
        <PageLoader text="Verifying Identity" />
      ) : (
        <Suspense fallback={<PageLoader text="Loading Workspace" />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login/*" element={<LoginPage />} />
            <Route path="/register/*" element={<RegisterPage />} />
            <Route path="/sign-in/*" element={<Navigate to="/login" replace />} />
            <Route path="/sign-up/*" element={<Navigate to="/register" replace />} />

            <Route
              path="/post-login"
              element={
                <ProtectedRoute>
                  <PostLoginRedirect />
                </ProtectedRoute>
              }
            />

            <Route
              path="/user-dashboard"
              element={
                <ProtectedRoute requiredRole="user">
                  <UserDashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredRole="coordinator">
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/needs-archive"
              element={
                <ProtectedRoute requiredRole="coordinator">
                  <NeedsArchivePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/volunteer-approvals"
              element={
                <ProtectedRoute requiredRole="coordinator">
                  <VolunteerApprovalsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/volunteer"
              element={
                <ProtectedRoute requiredRole="volunteer">
                  <VolunteerPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/field"
              element={
                <ProtectedRoute>
                  <FieldForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-reports"
              element={
                <ProtectedRoute>
                  <MyReportsPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          {isAuthenticated && <ChatWidget />}
        </Suspense>
      )}
    </>
  );
}

/**
 * App — minimal shell. Only providers and ErrorBoundary here.
 * NO hooks called at this level.
 */
function App() {
  return (
    <ErrorBoundary>
      <Router>
        <MainContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
