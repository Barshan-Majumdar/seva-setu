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
              <SignUp
                routing="path"
                path="/register"
                fallbackRedirectUrl={postLoginUrl}
                signInUrl="/login"
              />
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default RegisterPage;
