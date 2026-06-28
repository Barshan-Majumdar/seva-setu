import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../hooks/useAuth';
import {
  ChevronDown, Send, LogOut, Menu, X,
  LayoutDashboard, FileText, Users, MapPin, ClipboardCheck
} from 'lucide-react';

/* ── Role-based nav definitions ─────────────────────────────── */
const NAV_BY_ROLE = {
  coordinator: [
    { to: '/dashboard',            label: 'Dashboard',  Icon: LayoutDashboard },
    { to: '/needs-archive',        label: 'All Issues', Icon: FileText },
    { to: '/volunteer-approvals',  label: 'Volunteers', Icon: Users },
  ],
  volunteer: [
    { to: '/volunteer',   label: 'My Tasks',  Icon: ClipboardCheck },
    { to: '/my-reports',  label: 'Reports',   Icon: FileText },
  ],
  field_worker: [
    { to: '/field',       label: 'Report Need',  Icon: MapPin },
    { to: '/my-reports',  label: 'My Reports',   Icon: FileText },
  ],
  user: [
    { to: '/user-dashboard', label: 'Dashboard',   Icon: LayoutDashboard },
    { to: '/field',          label: 'Report Need', Icon: MapPin },
    { to: '/my-reports',     label: 'My Reports',  Icon: FileText },
  ],
};

const DASHBOARD_BY_ROLE = {
  coordinator:  '/dashboard',
  volunteer:    '/volunteer',
  field_worker: '/field',
  user:         '/user-dashboard',
};

const DASHBOARD_LABEL_BY_ROLE = {
  coordinator:  'Coordinator Hub',
  volunteer:    'Volunteer Console',
  field_worker: 'Field Terminal',
  user:         'My Dashboard',
};

const LANDING_NAV = [
  { href: '#features',  label: 'Features' },
  { href: '#workflow',  label: 'How It Works' },
  { href: '#roles',     label: 'Roles' },
];

const MainLayout = ({ children, hideFooter = false, hideHeader = false }) => {
  const { isAuthenticated, currentUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const role = currentUser?.role;
  const authNavLinks = NAV_BY_ROLE[role] || [];

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    closeMenu();
    logout();
  };

  // ── Authenticated SaaS Layout ──────────────────────────────
  if (isAuthenticated) {
    return (
      <div className="saas-layout-root">
        {/* Desktop Sidebar */}
        <aside className="saas-sidebar">
          <div className="saas-sidebar-header">
            <Link to={DASHBOARD_BY_ROLE[role] || '/'} className="nav-logo-link" style={{ gap: '0.75rem' }}>
              <Logo size={28} />
              <span className="nav-logo-text" style={{ fontSize: '1.2rem' }}>SevaSetu</span>
            </Link>
          </div>
          
          <nav className="saas-sidebar-nav">
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 1rem', marginBottom: '0.5rem' }}>
              Menu
            </p>
            {authNavLinks.map(({ to, label, Icon }) => {
              const isActive = location.pathname === to;
              return (
                <Link key={to} to={to} className={`saas-nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                  <Icon size={18} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="saas-sidebar-footer">
            {role && (
              <div style={{ marginBottom: '1rem' }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', padding: '0.35rem 0.75rem',
                  borderRadius: '6px', background: 'rgba(45, 97, 72, 0.08)',
                  border: '1px solid rgba(45, 97, 72, 0.15)', color: '#2d6148',
                  display: 'inline-block'
                }}>
                  {role.replace('_', ' ')}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="saas-nav-link danger"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="saas-main-wrapper">
          {/* Topbar (Mobile hamburger + User profile) */}
          <header className="saas-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                className="saas-mobile-hamburger"
                onClick={() => setMenuOpen(true)}
              >
                <Menu size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className="saas-topbar-title">{DASHBOARD_LABEL_BY_ROLE[role] || 'Dashboard'}</span>
              {/* Optional: Add user avatar or notification bell here */}
            </div>
          </header>

          {/* Mobile slide-out menu */}
          {menuOpen && (
            <div className="saas-mobile-menu-overlay" onClick={closeMenu}>
              <div className="saas-mobile-menu-content" onClick={e => e.stopPropagation()}>
                <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <Link to={DASHBOARD_BY_ROLE[role] || '/'} className="nav-logo-link">
                     <Logo size={24} />
                     <span className="nav-logo-text">SevaSetu</span>
                   </Link>
                   <button onClick={closeMenu} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={24} color="#64748b" /></button>
                </div>
                <nav className="saas-sidebar-nav">
                  {authNavLinks.map(({ to, label, Icon }) => {
                    const isActive = location.pathname === to;
                    return (
                      <Link key={to} to={to} className={`saas-nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                        <Icon size={18} />
                        {label}
                      </Link>
                    );
                  })}
                  <div style={{ margin: '1rem 0', height: 1, background: 'var(--color-border)' }} />
                  <button onClick={handleLogout} className="saas-nav-link danger">
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </nav>
              </div>
            </div>
          )}

          <main className="saas-main-content">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // ── Unauthenticated Landing Page Layout ──────────────────────
  return (
    <div className="layout-root">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      {!hideHeader && (
        <header className="site-header">
        <nav className="container-lg nav-bar">

          {/* Logo */}
          <div className="nav-left">
            <Link
              to="/"
              className="nav-logo-link"
              onClick={closeMenu}
            >
              <Logo size={32} />
              <span className="nav-logo-text">SevaSetu</span>
            </Link>

            {/* Desktop nav links */}
            <div className="nav-links-desktop">
              {LANDING_NAV.map(({ href, label }) => (
                <a key={href} href={href} className="nav-link">{label}</a>
              ))}
            </div>
          </div>

          {/* Right side — desktop */}
          <div className="nav-actions">
            <Link to="/login" className="nav-link">Sign in</Link>
            <Link to="/register" className="btn-primary nav-cta">Join the Mission</Link>

            {/* Hamburger — mobile only */}
            <button
              className="nav-hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
        </header>
      )}

      {/* ── Mobile slide-down menu ─────────────────────────────── */}
      {!hideHeader && (
        <div className={`nav-mobile-menu${menuOpen ? ' is-open' : ''}`} role="navigation">
        {LANDING_NAV.map(({ href, label }) => (
          <a key={href} href={href} className="nav-mobile-link" onClick={closeMenu}>{label}</a>
        ))}
        <div className="nav-mobile-divider" />
        <Link to="/login" className="nav-mobile-link" onClick={closeMenu}>Sign in</Link>
        <Link to="/register" className="nav-mobile-link nav-mobile-cta" onClick={closeMenu}>Join the Mission</Link>
        </div>
      )}

      {/* Overlay — closes menu when tapping outside */}
      {!hideHeader && menuOpen && (
        <div
          onClick={closeMenu}
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(15, 23, 29, 0.2)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ── Page Content ──────────────────────────────────────── */}
      <main className="layout-main">
        {children}
      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      {!hideFooter && (
        <footer className="site-footer">
          <div className="container-lg">
            <div className="footer-grid">
              <div className="footer-col-brand">
                <div className="footer-brand">
                  <Logo size={28} />
                  <span className="footer-brand-text">SevaSetu</span>
                </div>
                <p className="footer-desc">
                  An open initiative for community resilience and coordinated humanitarian response.
                </p>
              </div>

              <div className="footer-col">
                <h4>Platform</h4>
                <nav>
                  <a href="#features">Features</a>
                  <a href="#workflow">How It Works</a>
                  <a href="#roles">Roles</a>
                  <a href="#">Open Source</a>
                </nav>
              </div>

              <div className="footer-col">
                <h4>Resources</h4>
                <nav>
                  <a href="#">Help Center</a>
                  <a href="#">Docs</a>
                  <a href="#">Blog</a>
                  <a href="#">Case Studies</a>
                </nav>
              </div>

              <div className="footer-col">
                <h4>Company</h4>
                <nav>
                  <a href="#">About Us</a>
                  <a href="#">Contact</a>
                  <a href="#">Careers</a>
                </nav>
              </div>
            </div>

            <div className="footer-bottom">
              <p className="footer-copy">
                © 2026 SevaSetu Open Initiative — Community resilience, powered by AI.
              </p>
              <div className="footer-legal">
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
                <a href="#">GitHub</a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default MainLayout;
