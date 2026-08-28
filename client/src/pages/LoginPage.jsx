import { useState } from 'react';
import { useSignIn, useAuth } from '@clerk/react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import MainLayout from '../layouts/MainLayout';

const LoginPage = () => {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Handle Email/Password (100% In-App) ───────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError('');

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        navigate('/post-login');
      } else {
        console.log('Incomplete sign-in:', result);
      }
    } catch (err) {
      setError(err.errors?.[0]?.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Google (In-App Browser Layer) ──────────────────
  const handleGoogleSignIn = async () => {
    if (!isLoaded) return;

    // On Web, use standard redirect
    if (!Capacitor.isNativePlatform()) {
      signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/post-login',
      });
      return;
    }

    // On Native, we use the Browser plugin to keep it inside the app
    try {
      const { signUp, signIn: sIn, firstFactorVerification } = await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: 'com.sevasetu.app://sso-callback',
        redirectUrlComplete: 'com.sevasetu.app://post-login',
      });
    } catch (err) {
      console.error('Google Sign-In Error:', err);
    }
  };

  if (isSignedIn) return <Navigate to="/post-login" replace />;

  return (
    <MainLayout hideFooter={true} hideHeader={true}>
      <section className="auth-shell">
        <div className="auth-visual-side">
          <img src="/images/auth-side.png" alt="Mission coordination" />
          <div className="auth-visual-content">
            <h2>Command, coordinate, and conquer crisis.</h2>
            <p>Access your workspace to manage resources and track real-time impact.</p>
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
              </div>

              {error && (
                <div className="auth-error-banner" style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '12px', display: 'flex', gap: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="field-label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="email"
                      className="input-field"
                      style={{ paddingLeft: '40px' }}
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="field-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="password"
                      className="input-field"
                      style={{ paddingLeft: '40px' }}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', minHeight: '52px', marginTop: '0.5rem' }}>
                  {loading ? <Loader2 className="animate-spin" /> : 'Sign In'}
                </button>
              </form>

              <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
              </div>

              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  console.log('Google Sign-In Clicked');
                  handleGoogleSignIn();
                }}
                style={{
                  width: '100%',
                  minHeight: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 10,
                  opacity: isLoaded ? 1 : 0.6
                }}
              >
                <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" style={{ width: '20px', height: '20px' }} />
                {isLoaded ? 'Continue with Google' : 'Loading Google...'}
              </button>

              <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', color: '#64748b' }}>
                Don't have an account? <Link to="/register" style={{ color: '#2d6148', fontWeight: 700 }}>Join SevaSetu</Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default LoginPage;
