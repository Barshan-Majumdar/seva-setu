import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import Logo from './components/Logo';
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load pages for performance
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const FieldForm = lazy(() => import('./pages/FieldForm'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const VolunteerPage = lazy(() => import('./pages/VolunteerPage'));

const PageLoader = () => (
  <div className="min-h-screen bg-surface-primary flex items-center justify-center">
    <div className="flex flex-col items-center space-y-4">
      <Logo size={64} className="animate-pulse" />
      <div className="flex items-center space-x-2 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs font-bold uppercase tracking-[0.2em]">Synchronizing</span>
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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/sign-in/*" element={<Navigate to="/login" replace />} />
            <Route path="/sign-up/*" element={<Navigate to="/register" replace />} />

            <Route
              path="/field"
              element={
                <ProtectedRoute>
                  <FieldForm />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/volunteer"
              element={
                <ProtectedRoute>
                  <VolunteerPage />
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

