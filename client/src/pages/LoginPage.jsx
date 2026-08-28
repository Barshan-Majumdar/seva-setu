import { SignIn, useAuth } from '@clerk/react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import MainLayout from '../layouts/MainLayout';

const LoginPage = () => {
  const { isSignedIn, isLoaded } = useAuth();

  // On Native, we redirect to Vercel first, which will then "bounce" the user back to the app
  // This avoids Clerk "Unauthorized Redirect" errors in dev mode.
  const postLoginUrl = Capacitor.isNativePlatform()
    ? 'https://seva-setu-ai.vercel.app/post-login'
    : '/post-login';

  // Already signed in → let PostLoginRedirect handle role detection & routing
  if (isLoaded && isSignedIn) {
    return <Navigate to="/post-login" replace />;
  }

  return (
    <MainLayout hideFooter={true} hideHeader={true}>
      <section className="auth-shell">
        <div className="auth-visual-side">
          <img src="/images/auth-side.png" alt="Mission coordination" />
          <div className="auth-visual-content">
            <h2>Command, coordinate, and conquer crisis.</h2>
            <p>
              Access your workspace to manage resources, deploy volunteers, and track real-time impact on the ground.
            </p>
          </div>
        </div>

        <div className="auth-form-side">
          <div className="auth-card-wrap">
            <div className="auth-card">
              <Link to="/" className="auth-back-link">
                <ArrowLeft size={16} /> Back to home
              </Link>
              <div className="auth-header">
                <p className="landing-eyebrow">Account Access</p>
                <h1 className="auth-title">Welcome Back</h1>
                <p className="auth-subtitle">
                  Sign in to continue your coordination work.
                </p>
              </div>

              {Capacitor.isNativePlatform() ? (
                <div className="native-auth-wrapper" style={{ marginTop: '1.5rem' }}>
                  <button
                    className="btn-primary"
                    style={{ width: '100%', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
                    onClick={() => window.location.href = 'https://seva-setu-ai.vercel.app/login'}
                  >
                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" style={{ width: '20px', height: '20px' }} />
                    Continue with Google
                  </button>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '1rem' }}>
                    You will be redirected to your browser to sign in securely, then returned to the app.
                  </p>
                </div>
              ) : (
                <SignIn
                  routing="path"
                  path="/login"
                  forceRedirectUrl={postLoginUrl}
                  signUpUrl="/register"
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default LoginPage;
