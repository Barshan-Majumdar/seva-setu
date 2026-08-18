import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import Logo from './components/Logo';
import ProtectedRoute from './components/ProtectedRoute';
import AuthTokenBridge from './components/AuthTokenBridge';
import RoleSync from './components/RoleSync';
import ChatWidget from './components/ChatWidget';
import ServerMaintenanceAlert from './components/ServerMaintenanceAlert';
import LoadingScreen from './components/LoadingScreen';
import { useAuth } from './hooks/useAuth';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in your .env file');
}

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
const ShelterDashboardPage = lazy(() => import('./pages/ShelterDashboardPage'));
const PublicSheltersPage = lazy(() => import('./pages/PublicSheltersPage'));

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
 * ClerkProviderWithRouter — Wraps Clerk around our React Router.
 * This fixes the blank/whitescreen issue on login because Clerk now 
 * pushes navigation events directly into React Router instead of fighting it via window.history.
 */
function ClerkProviderWithRouter({ children }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      appearance={{
        variables: {
          colorPrimary: '#2d6148',
          colorBackground: '#ffffff',
          colorInputBackground: '#ffffff',
          colorInputText: '#0f171d',
          colorText: '#0f171d',
          colorTextSecondary: '#475569',
          colorTextOnPrimaryBackground: '#ffffff',
          borderRadius: '0.75rem',
          fontFamily: 'Inter, Manrope, sans-serif',
        },
        elements: {
          cardBox: { boxShadow: '0 40px 100px rgba(0, 0, 0, 0.05)', border: '1px solid rgba(15, 23, 29, 0.08)' },
          card: { background: '#ffffff', borderRadius: '24px' },
          footer: { background: 'transparent' },
          footerAction: { color: '#2d6148' },
        }
      }}
    >
      {children}
    </ClerkProvider>
  );
}

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
      {/* <ServerMaintenanceAlert /> */}
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
              path="/shelters"
              element={
                <ProtectedRoute requiredRole="coordinator">
                  <ShelterDashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/public-shelters"
              element={
                <ProtectedRoute>
                  <PublicSheltersPage />
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
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('introShown');
  });

  const handleIntroComplete = useCallback(() => {
    sessionStorage.setItem('introShown', 'true');
    setShowIntro(false);
  }, []);

  return (
    <ErrorBoundary>
      {showIntro && <LoadingScreen onComplete={handleIntroComplete} />}
      <Router>
        <ClerkProviderWithRouter>
          <MainContent />
        </ClerkProviderWithRouter>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
