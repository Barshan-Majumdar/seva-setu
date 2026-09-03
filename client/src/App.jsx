import { lazy, Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ClerkProvider, SignIn, SignUp } from '@clerk/react';
import { Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { Browser } from '@capacitor/browser';
import ErrorBoundary from './components/ErrorBoundary';
import Logo from './components/Logo';
import ProtectedRoute from './components/ProtectedRoute';
import AuthTokenBridge from './components/AuthTokenBridge';
import RoleSync from './components/RoleSync';
import ChatWidget from './components/ChatWidget';
import ServerMaintenanceAlert from './components/ServerMaintenanceAlert';
import LoadingScreen from './components/LoadingScreen';
import { useAuth } from './hooks/useAuth';
import { requestAllPermissions } from './services/NativePermissions';
import backgroundVoiceService from './services/BackgroundVoiceService';

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
const VoiceEmergencyModal = lazy(() => import('./components/emergency/VoiceEmergencyModal'));

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
 */
function MainContent() {
  const { isAuthenticated } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();

  const handleSyncReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const [showVoiceEmergency, setShowVoiceEmergency] = useState(false);
  const bgVoiceInitialized = useRef(false);

  // Request all native permissions on first launch
  useEffect(() => {
    if (isReady) {
      requestAllPermissions().then(results => {
        console.log('[App] Permission results:', results);
      }).catch(err => {
        console.warn('[App] Permission request error:', err);
      });
    }
  }, [isReady]);

  // Start background wake word listener after user is authenticated (NATIVE ONLY)
  useEffect(() => {
    if (isAuthenticated && isReady && !bgVoiceInitialized.current) {
      bgVoiceInitialized.current = true;
      
      // We only want continuous background listening on Native Mobile
      // Web browsers (Chrome/Safari) aggressively kill background mic access, causing flickering
      if (Capacitor.isNativePlatform()) {
        const supported = backgroundVoiceService.init((transcript) => {
          console.log('[App] Wake word detected! Opening emergency modal...');
          setShowVoiceEmergency(true);
        });
        
        if (supported) {
          backgroundVoiceService.start();
        }
      } else {
        console.log('[App] Web environment detected. Skipping background wake word to prevent browser mic flickering.');
      }
    }

    return () => {
      // Don't stop on cleanup — we want it to persist across route changes
    };
  }, [isAuthenticated, isReady]);

  // Pause background voice when emergency modal is open, resume when closed
  const handleVoiceEmergencyClose = useCallback(() => {
    setShowVoiceEmergency(false);
    // Resume background listening after a delay for audio to settle
    setTimeout(() => backgroundVoiceService.resume(), 1500);
  }, []);

  // Deep Link & Native Permission Handler
  useEffect(() => {
    let appUrlListener = null;

    const setupApp = async () => {
      // 1. Handle Deep Links (for OAuth redirects like Google)
      if (Capacitor.isNativePlatform()) {
        appUrlListener = await CapApp.addListener('appUrlOpen', async (data) => {
          console.log('[Native] App opened with URL:', data.url);

          // Close the in-app browser layer if it's open
          await Browser.close().catch(() => {});

          const slug = data.url.split('.app://').pop();
          if (slug) {
            navigate('/' + slug);
          }
        });
      }
    };

    setupApp();

    return () => {
      if (appUrlListener) appUrlListener.remove();
    };
  }, [isReady, navigate]);

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
            <Route
              path="/sign-in/*"
              element={
                <div className="min-h-screen flex items-center justify-center bg-surface-primary relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-sky/[0.03] rounded-full blur-[120px]" />
                  <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">
                    <div className="mb-8">
                      <Logo size={48} />
                    </div>
                    {(() => {
                      const redirectUrl = Capacitor.isNativePlatform() ? 'sevasetu://post-login' : '/post-login';
                      return <SignIn routing={clerkRouting} {...(Capacitor.isNativePlatform() ? {} : { path: "/sign-in" })} fallbackRedirectUrl={redirectUrl} forceRedirectUrl={redirectUrl} />;
                    })()}
                  </div>
                </div>
              }
            />
            <Route
              path="/sign-up/*"
              element={
                <div className="min-h-screen flex items-center justify-center bg-surface-primary relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-indigo/[0.03] rounded-full blur-[120px]" />
                  <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">
                    <div className="mb-8">
                      <Logo size={48} />
                    </div>
                    {(() => {
                      const redirectUrl = Capacitor.isNativePlatform() ? 'sevasetu://post-login' : '/post-login';
                      return <SignUp routing={clerkRouting} {...(Capacitor.isNativePlatform() ? {} : { path: "/sign-up" })} fallbackRedirectUrl={redirectUrl} forceRedirectUrl={redirectUrl} />;
                    })()}
                  </div>
                </div>
              }
            />
            <Route path="/login/*" element={<Navigate to="/sign-in" replace />} />
            <Route path="/register/*" element={<Navigate to="/sign-up" replace />} />

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

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          {isAuthenticated && <ChatWidget />}

          {/* Voice Emergency Modal — triggered by wake word or manual activation */}
          {showVoiceEmergency && (
            <Suspense fallback={null}>
              <VoiceEmergencyModal onClose={handleVoiceEmergencyClose} />
            </Suspense>
          )}
        </Suspense>
      )}
    </>
  );
}

const AppRouter = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;
const clerkRouting = Capacitor.isNativePlatform() ? 'virtual' : 'path';

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
      <AppRouter>
        <ClerkProviderWithRouter>
          <MainContent />
        </ClerkProviderWithRouter>
      </AppRouter>
    </ErrorBoundary>
  );
}

export default App;
