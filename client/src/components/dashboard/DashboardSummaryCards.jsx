import { Users, UserCheck, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * DashboardSummaryCards — Shows real-time coordinator stats
 * pulled from the API via useCoordinatorDashboard.
 * Colors are earthy/professional, NOT the landing page palette.
 */
const DashboardSummaryCards = ({ summary }) => {
  const isLoading = !summary || Object.keys(summary).length === 0;

  const cards = [
    {
      label: 'Open Needs',
      value: summary?.openNeeds,
      icon: AlertTriangle,
      color: '#c35d51',        // rust — urgent
      bg: 'rgba(195, 93, 81, 0.06)',
      border: 'rgba(195, 93, 81, 0.15)',
    },
    {
      label: 'Active Volunteers',
      value: summary?.activeVolunteers,
      icon: UserCheck,
      color: '#2d6148',        // moss — action
      bg: 'rgba(45, 97, 72, 0.06)',
      border: 'rgba(45, 97, 72, 0.15)',
    },
    {
      label: 'Total Members',
      value: summary?.totalUsers,
      icon: Users,
      color: '#475569',        // slate — neutral
      bg: 'rgba(71, 85, 105, 0.06)',
      border: 'rgba(71, 85, 105, 0.12)',
    },
    {
      label: 'Completed Today',
      value: summary?.completedToday,
      icon: CheckCircle,
      color: '#059669',        // green — positive
      bg: 'rgba(5, 150, 105, 0.06)',
      border: 'rgba(5, 150, 105, 0.15)',
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
                  background: 'rgba(15, 23, 29, 0.06)',
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b'
            }}>
              <card.icon size={20} strokeWidth={1.5} />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
};

export default DashboardSummaryCards;
