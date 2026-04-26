import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../hooks/useAuth';

const MainLayout = ({ children }) => {
  const { isAuthenticated, currentUser, logout } = useAuth();

  return (
    <div className="layout-root">

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header className="site-header">
        <nav className="container-lg nav-bar">
          {/* Logo */}
          <Link to="/" className="nav-logo-link">
            <Logo size={32} />
            <span className="nav-logo-text">SevaSetu</span>
          </Link>

          {/* Nav actions */}
          <div className="nav-actions">
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="nav-link">
                Sign in
                </Link>
                <Link to="/register" className="btn-primary nav-cta">
                  Get Started
                </Link>
              </>
            ) : (
              <>
                {currentUser?.role !== 'coordinator' && (
                  <Link to="/field" className="nav-link">
                  Report Need
                  </Link>
                )}
                <Link to="/my-reports" className="nav-link">
                My Reports
                </Link>
                {currentUser?.role === 'coordinator' && (
                  <Link to="/dashboard" className="btn-primary nav-cta">
                      Dashboard
                  </Link>
                )}
                {currentUser?.role === 'volunteer' && (
                  <Link to="/volunteer" className="btn-primary nav-cta">
                    Volunteer Dash
                  </Link>
                )}
                {currentUser?.role === 'user' && (
                  <Link to="/user-dashboard" className="btn-primary nav-cta">
                    My Dashboard
                  </Link>
                )}
                {currentUser?.role === 'field_worker' && (
                  <Link to="/field" className="btn-primary nav-cta">
                    Field Terminal
                  </Link>
                )}
                <div className="nav-user-section">
                  <span className="nav-user-name">
                    {currentUser?.name || currentUser?.email || 'User'}
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="nav-link"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Page Content ────────────────────────────────────────────── */}
      <main className="layout-main">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="site-footer">
        <div className="container-lg footer-inner">
          <div className="footer-brand">
            <Logo size={24} opacity={0.5} />
            <span className="footer-brand-text">SevaSetu</span>
          </div>
          <p className="footer-copy">
            © 2026 SevaSetu Open Initiative — Community resilience, powered by AI.
          </p>
          <div className="footer-links">
            {['Privacy', 'Terms', 'GitHub'].map(link => (
              <a key={link} href="#" className="footer-link">
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
