import { LANDING_STATS } from './content';

const StatsStrip = () => (
  <section className="landing-stats" aria-label="Key stats">
    <div className="container-lg">
      <ul className="landing-stats-grid">
        {LANDING_STATS.map((stat) => (
          <li key={stat.label}>
            <p className="landing-stat-value">{stat.value}</p>
            <p className="landing-stat-label">{stat.label}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default StatsStrip;

