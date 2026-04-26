import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import Logo from './components/Logo';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load all pages for performance and consistent bundle chunking
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

const PageLoader = () => (
  <div className="page-loader">
    <div className="page-loader-inner">
      <Logo size={64} className="pulse" />
      <div className="page-loader-status">
        <Loader2 className="icon-spin" style={{ width: 16, height: 16 }} />
        <span className="page-loader-text">Synchronizing</span>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login/*" element={<LoginPage />} />
            <Route path="/register/*" element={<RegisterPage />} />
            <Route path="/sign-in/*" element={<Navigate to="/login" replace />} />
            <Route path="/sign-up/*" element={<Navigate to="/register" replace />} />

            {/* Post-login redirect — fetches DB role & routes to correct workspace */}
            <Route
              path="/post-login"
              element={
                <ProtectedRoute>
                  <PostLoginRedirect />
                </ProtectedRoute>
              }
            />

            {/* User dashboard (default for new users) */}
            <Route
              path="/user-dashboard"
              element={
                <ProtectedRoute requiredRole="user">
                  <UserDashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Coordinator-only dashboard */}
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

            {/* Coordinator: Volunteer Approvals */}
            <Route
              path="/volunteer-approvals"
              element={
                <ProtectedRoute requiredRole="coordinator">
                  <VolunteerApprovalsPage />
                </ProtectedRoute>
              }
            />

            {/* Volunteer workspace */}
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
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
