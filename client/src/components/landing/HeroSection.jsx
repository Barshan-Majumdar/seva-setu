import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const HeroSection = () => {
  const { isAuthenticated } = useAuth();

  return (
    <section className="landing-hero">
      <div className="container-lg">
        <div className="landing-hero-grid">
          <div>
            <p className="landing-eyebrow">AI-Aided Response Grid</p>
            <h1 className="landing-display">Relief operations with cleaner decisions and faster ground execution.</h1>
            <p className="landing-subcopy">
              SevaSetu helps NGOs and volunteers coordinate verified response workflows from first report to final closure.
            </p>
            <div className="landing-hero-actions">
              {!isAuthenticated ? (
                <Link to="/register" className="btn-primary">
                  Start Coordinating
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link to="/dashboard" className="btn-primary">
                  Open Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link to="/field" className="btn-ghost">
                Submit Field Report
              </Link>
            </div>
          </div>

          <aside className="landing-hero-panel" aria-label="Operational summary">
            <p className="text-xs uppercase tracking-[0.16em] text-text-muted">Live Snapshot</p>
            <ul className="space-y-4 mt-4">
              <li className="landing-kpi-row">
                <span>Active Districts</span>
                <strong>124</strong>
              </li>
              <li className="landing-kpi-row">
                <span>Open Requests</span>
                <strong>2,918</strong>
              </li>
              <li className="landing-kpi-row">
                <span>Volunteers Online</span>
                <strong>18,406</strong>
              </li>
              <li className="landing-kpi-row">
                <span>Avg. Closure</span>
                <strong>43m</strong>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
