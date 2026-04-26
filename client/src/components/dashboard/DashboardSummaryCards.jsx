import { Users, UserCheck, AlertTriangle, CheckCircle } from 'lucide-react';

const DashboardSummaryCards = ({ summary }) => {
  const cards = [
    { label: 'Open Needs', value: summary.openNeeds, icon: AlertTriangle, color: '#fb7185' },
    { label: 'Active Volunteers', value: summary.activeVolunteers, icon: UserCheck, color: '#34d399' },
    { label: 'Total Members', value: summary.totalUsers, icon: Users, color: '#60a5fa' },
    { label: 'Completed Today', value: summary.completedToday, icon: CheckCircle, color: '#a78bfa' },
  ];

  return (
    <section className="dashboard-summary-grid" aria-label="Summary cards">
      {cards.map((card) => (
        <article className="dashboard-summary-card" key={card.label}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p className="dashboard-summary-label">{card.label}</p>
              <p className="dashboard-summary-value" style={{ color: card.color }}>
                {card.value ?? 0}
              </p>
            </div>
            <card.icon size={28} style={{ color: card.color, opacity: 0.4 }} />
          </div>
        </article>
      ))}
    </section>
  );
};

export default DashboardSummaryCards;
