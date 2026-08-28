import { useState } from 'react';
import { useSignUp, useAuth } from '@clerk/react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import MainLayout from '../layouts/MainLayout';

const RegisterPage = () => {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setFirstName_last] = useState(''); // Clerk uses firstName/lastName
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const [verifying, setVerifying] = useState(false); // For OTP stage
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Handle Initial Sign Up ───────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError('');

    try {
      await signUp.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      });

      // Send the email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setVerifying(true);
    } catch (err) {
      setError(err.errors?.[0]?.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle OTP Verification ──────────────────────────────
  const handleVerify = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError('');

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        navigate('/post-login');
      }
    } catch (err) {
      setError(err.errors?.[0]?.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Google SSO ────────────────────────────────────
  const handleGoogleSignUp = async () => {
    if (!isLoaded) return;

    if (!Capacitor.isNativePlatform()) {
      signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/post-login',
      });
      return;
    }

    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: 'com.sevasetu.app://sso-callback',
        redirectUrlComplete: 'com.sevasetu.app://post-login',
      });
    } catch (err) {
      console.error('Google Sign-Up Error:', err);
    }
  };

  if (isSignedIn) return <Navigate to="/post-login" replace />;

  return (
    <MainLayout hideFooter={true} hideHeader={true}>
      <section className="auth-shell">
        <div className="auth-visual-side">
          <img src="/images/auth-side.png" alt="Mission coordination" />
          <div className="auth-visual-content">
            <h2>Turning empathy into efficient action.</h2>
            <p>Join a network of responders dedicated to bridging the gap between crisis and recovery.</p>
          </div>
        </div>

        <div className="auth-form-side">
          <div className="auth-card-wrap">
            <div className="auth-card">
              <Link to="/" className="auth-back-link">
                <ArrowLeft size={16} /> Back to home
              </Link>

              {!verifying ? (
                <>
                  <div className="auth-header">
                    <p className="landing-eyebrow">Start Your Mission</p>
                    <h1 className="auth-title">Join SevaSetu</h1>
                  </div>

                  {error && (
                    <div className="auth-error-banner" style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '12px', display: 'flex', gap: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                      <AlertCircle size={18} />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="field-label">First Name</label>
                        <input type="text" className="input-field" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="field-label">Last Name</label>
                        <input type="text" className="input-field" placeholder="Doe" value={lastName} onChange={(e) => setFirstName_last(e.target.value)} required />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="field-label">Email Address</label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input type="email" className="input-field" style={{ paddingLeft: '40px' }} placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="field-label">Password</label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input type="password" className="input-field" style={{ paddingLeft: '40px' }} placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
                      </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', minHeight: '52px', marginTop: '0.5rem' }}>
                      {loading ? <Loader2 className="animate-spin" /> : 'Create Account'}
                    </button>
                  </form>

                  <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
                  </div>

                  <button type="button" className="btn-outline" onClick={handleGoogleSignUp} style={{ width: '100%', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'white', border: '1px solid #e2e8f0' }}>
                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="Google" style={{ width: '20px', height: '20px' }} />
                    Sign up with Google
                  </button>
                </>
              ) : (
                <div className="verify-stage animate-in">
                  <div className="auth-header">
                    <CheckCircle className="w-12 h-12" style={{ color: '#2d6148', marginBottom: '1rem' }} />
                    <h1 className="auth-title">Check your email</h1>
                    <p className="auth-subtitle">We sent a 6-digit verification code to <strong>{email}</strong></p>
                  </div>

                  {error && (
                    <div className="auth-error-banner" style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="field-label">Verification Code</label>
                      <input
                        type="text"
                        className="input-field"
                        style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em', fontWeight: 800 }}
                        placeholder="000000"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', minHeight: '52px' }}>
                      {loading ? <Loader2 className="animate-spin" /> : 'Verify & Finish'}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setVerifying(false)} style={{ fontSize: '0.875rem' }}>
                      Back to details
                    </button>
                  </form>
                </div>
              )}

              <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', color: '#64748b' }}>
                Already have an account? <Link to="/login" style={{ color: '#2d6148', fontWeight: 700 }}>Sign In</Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default RegisterPage;
