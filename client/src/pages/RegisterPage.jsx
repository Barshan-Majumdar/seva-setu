import { SignUp } from '@clerk/react';
import MainLayout from '../layouts/MainLayout';

const RegisterPage = () => (
  <MainLayout>
    <section className="container-lg auth-shell">
      <div className="auth-card-wrap">
        <div className="auth-card">
          <p className="landing-eyebrow">Create Account</p>
          <h1 className="auth-title">Join SevaSetu</h1>
          <p className="auth-subtitle">Register your role and start helping needs reach responders faster.</p>
          <SignUp
            routing="path"
            path="/register"
            fallbackRedirectUrl="/dashboard"
            signInUrl="/login"
          />
        </div>
      </div>
    </section>
  </MainLayout>
);

export default RegisterPage;
