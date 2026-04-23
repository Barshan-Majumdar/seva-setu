import { Link } from 'react-router-dom';
import { Show, UserButton } from '@clerk/react';
import Logo from '../components/Logo';

const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-surface-primary flex flex-col">

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface-primary/80 backdrop-blur-xl">
        <nav className="container-lg flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Logo size={32} />
            <span className="text-base font-bold text-text-primary tracking-tight">SevaSetu</span>
          </Link>

          {/* Nav actions */}
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <Link to="/sign-in" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-2">
                Sign in
              </Link>
              <Link to="/sign-up" className="btn-primary text-sm py-2 px-5">
                Get Started
              </Link>
            </Show>
            <Show when="signed-in">
              <Link to="/field" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-2">
                Report Need
              </Link>
              <Link to="/dashboard" className="btn-primary text-sm py-2 px-5">
                Dashboard
              </Link>
              <div className="pl-3 border-l border-border">
                <UserButton
                  appearance={{ elements: { userButtonAvatarBox: 'w-8 h-8' } }}
                  signOutBackToUrl="/"
                />
              </div>
            </Show>
          </div>
        </nav>
      </header>

      {/* ── Page Content ────────────────────────────────────────────── */}
      <main className="flex-1">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-surface-secondary">
        <div className="container-lg py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size={24} opacity={0.5} />
            <span className="text-sm font-semibold text-text-muted">SevaSetu</span>
          </div>
          <p className="text-xs text-text-muted text-center">
            © 2026 SevaSetu Open Initiative — Community resilience, powered by AI.
          </p>
          <div className="flex items-center gap-6">
            {['Privacy', 'Terms', 'GitHub'].map(link => (
              <a key={link} href="#" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
};

export default MainLayout;
