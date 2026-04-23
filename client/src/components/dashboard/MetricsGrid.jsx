import { DASHBOARD_METRICS } from './content';

const MetricsGrid = () => (
  <section aria-label="Operational metrics">
    <ul className="dashboard-metric-grid">
      {DASHBOARD_METRICS.map((metric) => (
        <li key={metric.label} className="dashboard-metric-card">
          <p className="dashboard-metric-label">{metric.label}</p>
          <p className="dashboard-metric-value">{metric.value}</p>
          <p className="dashboard-metric-delta">{metric.delta}</p>
        </li>
      ))}
    </ul>
  </section>
);

export default MetricsGrid;

