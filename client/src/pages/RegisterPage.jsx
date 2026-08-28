import { SignUp, useAuth } from '@clerk/react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import MainLayout from '../layouts/MainLayout';

const RegisterPage = () => {
  const { isSignedIn, isLoaded } = useAuth();

  // On Native, we redirect to Vercel first, which will then "bounce" the user back to the app
  // This avoids Clerk "Unauthorized Redirect" errors in dev mode.
  const postLoginUrl = Capacitor.isNativePlatform()
    ? 'https://seva-setu-ai.vercel.app/post-login'
    : '/post-login';

  // Already signed in → PostLoginRedirect decides what to show
  if (isLoaded && isSignedIn) {
    return <Navigate to="/post-login" replace />;
  }

  return (
    <MainLayout hideFooter={true} hideHeader={true}>
      <section className="auth-shell">
        <div className="auth-visual-side">
          <img src="/images/auth-side.png" alt="Mission coordination" />
          <div className="auth-visual-content">
            <h2>Turning empathy into efficient action.</h2>
            <p>
              Join a network of responders dedicated to bridging the gap between crisis and recovery through technology.
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
                <p className="landing-eyebrow">Start Your Mission</p>
                <h1 className="auth-title">Join SevaSetu</h1>
                <p className="auth-subtitle">
                  Create an account to begin coordinating, reporting, or volunteering.
                </p>
              </div>

              {Capacitor.isNativePlatform() ? (
                <div className="native-auth-wrapper" style={{ marginTop: '1.5rem' }}>
                  <button
                    className="btn-primary"
                    style={{ width: '100%', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
                    onClick={() => {
                      localStorage.setItem('was_native_auth', 'true');
                      window.location.href = 'https://seva-setu-ai.vercel.app/register';
                    }}
                  >
                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" style={{ width: '20px', height: '20px' }} />
                    Sign up with Google
                  </button>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '1rem' }}>
                    You will be redirected to your browser to create an account securely, then returned to the app.
                  </p>
                </div>
              ) : (
                <SignUp
                  routing="path"
                  path="/register"
                  forceRedirectUrl={postLoginUrl}
                  signInUrl="/login"
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default RegisterPage;
