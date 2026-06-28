import { Users, UserCheck, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * DashboardSummaryCards — Premium coordinator stats cards
 * with colored accent lines and icon background circles.
 */
const DashboardSummaryCards = ({ summary }) => {
  const isLoading = !summary || Object.keys(summary).length === 0;

  const cards = [
    {
      label: 'Open Needs',
      value: summary?.openNeeds,
      icon: AlertTriangle,
      color: '#c35d51',
      bg: 'rgba(195, 93, 81, 0.07)',
    },
    {
      label: 'Active Volunteers',
      value: summary?.activeVolunteers,
      icon: UserCheck,
      color: '#2d6148',
      bg: 'rgba(45, 97, 72, 0.07)',
    },
    {
      label: 'Total Members',
      value: summary?.totalUsers,
      icon: Users,
      color: '#475569',
      bg: 'rgba(71, 85, 105, 0.06)',
    },
    {
      label: 'Completed Today',
      value: summary?.completedToday,
      icon: CheckCircle,
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.07)',
    },
  ];

  return (
    <section className="dashboard-summary-grid" aria-label="Summary cards">
      {cards.map((card) => (
        <article
          className="dashboard-summary-card"
          key={card.label}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="dashboard-summary-label">{card.label}</p>
              {isLoading ? (
                <div style={{
                  height: '2rem',
                  width: '4rem',
                  background: 'rgba(0, 0, 0, 0.04)',
                  borderRadius: '8px',
                  marginTop: '0.5rem',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ) : (
                <p className="dashboard-summary-value">
                  {card.value ?? 0}
                </p>
              )}
            </div>
            <div
              className="dashboard-summary-icon"
              style={{
                background: card.bg,
                color: card.color,
              }}
            >
              <card.icon size={20} strokeWidth={1.8} />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
};

export default DashboardSummaryCards;
