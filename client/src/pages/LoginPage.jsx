import { SignIn, useAuth } from '@clerk/react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';

const LoginPage = () => {
  const { isSignedIn, isLoaded } = useAuth();

  // Already signed in → let PostLoginRedirect handle role detection & routing
  if (isLoaded && isSignedIn) {
    return <Navigate to="/post-login" replace />;
  }

  return (
    <MainLayout hideFooter={true}>
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
              <SignIn
                routing="path"
                path="/login"
                fallbackRedirectUrl="/post-login"
                signUpUrl="/register"
              />
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default LoginPage;
