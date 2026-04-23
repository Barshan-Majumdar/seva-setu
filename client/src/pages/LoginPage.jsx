import { SignIn } from '@clerk/react';
import MainLayout from '../layouts/MainLayout';

const LoginPage = () => (
  <MainLayout>
    <section className="container-lg auth-shell">
      <div className="auth-card-wrap">
        <div className="auth-card">
          <p className="landing-eyebrow">Account Access</p>
          <h1 className="auth-title">Sign in to SevaSetu</h1>
          <p className="auth-subtitle">Continue coordinating response operations in your command workspace.</p>
          <SignIn
            routing="path"
            path="/login"
            fallbackRedirectUrl="/dashboard"
            signUpUrl="/register"
          />
        </div>
      </div>
    </section>
  </MainLayout>
);

export default LoginPage;
