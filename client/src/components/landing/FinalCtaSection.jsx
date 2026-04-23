import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const FinalCtaSection = () => (
  <section className="landing-section">
    <div className="container-lg">
      <div className="landing-cta-shell">
        <h2>Move from fragmented updates to coordinated action.</h2>
        <p>
          Bring your NGO operations, field teams, and volunteer dispatch into one clean command flow.
        </p>
        <div className="landing-hero-actions">
          <Link to="/register" className="btn-primary">
            Join SevaSetu
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/dashboard" className="btn-ghost">
            View Dashboard
          </Link>
        </div>
      </div>
    </div>
  </section>
);

export default FinalCtaSection;
