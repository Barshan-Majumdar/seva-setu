import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import {
  Show,
  RedirectToSignIn,
  SignIn,
  SignUp,
} from '@clerk/react';
import { ChevronLeft, Activity, Loader2 } from 'lucide-react';
import MainLayout from './layouts/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import Logo from './components/Logo';

// ✅ Lazy load pages for performance (Code Splitting)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const FieldForm = lazy(() => import('./pages/FieldForm'));

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
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            
            <Route
              path="/sign-in/*"
              element={
                <div className="min-h-screen flex items-center justify-center bg-surface-primary relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-sky/[0.03] rounded-full blur-[120px]" />
                  <div className="relative z-10 w-full max-w-md px-6">
                    <div className="flex justify-center mb-8">
                      <Logo size={48} />
                    </div>
                    <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/field" />
                  </div>
                </div>
              }
            />
            <Route
              path="/sign-up/*"
              element={
                <div className="min-h-screen flex items-center justify-center bg-surface-primary relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-indigo/[0.03] rounded-full blur-[120px]" />
                  <div className="relative z-10 w-full max-w-md px-6">
                    <div className="flex justify-center mb-8">
                      <Logo size={48} />
                    </div>
                    <SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/field" />
                  </div>
                </div>
              }
            />

            {/* Protected Routes using MainLayout */}
            <Route
              path="/field"
              element={
                <>
                  <Show when="signed-in">
                    <FieldForm />
                  </Show>
                  <Show when="signed-out">
                    <RedirectToSignIn />
                  </Show>
                </>
              }
            />
            
            <Route
              path="/dashboard"
              element={
                <MainLayout>
                  <Show when="signed-in">
                    <div className="py-12 px-4">
                      <div className="max-w-4xl mx-auto">
                        <div className="mb-8">
                          <h1 className="text-2xl font-bold text-text-primary mb-1">Command Center</h1>
                          <p className="text-sm text-text-muted">Strategic Coordination Hub</p>
                        </div>
                        <div className="card p-16 text-center border-dashed border-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                          <Activity className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-30" />
                          <h2 className="text-base font-semibold text-text-primary mb-2">Intelligence Dashboard</h2>
                          <p className="text-sm text-text-muted max-w-xs mx-auto">
                            Connecting real-time field data to regional coordinators. Coming in Phase 3.4.
                          </p>
                        </div>
                      </div>
                    </div>
                  </Show>
                  <Show when="signed-out">
                    <RedirectToSignIn />
                  </Show>
                </MainLayout>
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

