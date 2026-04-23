const DashboardSummaryCards = ({ summary }) => {
  const cards = [
    { label: 'Total Open Needs', value: summary.openNeeds },
    { label: 'Active Volunteers', value: summary.activeVolunteers },
    { label: 'Tasks In Progress', value: summary.tasksInProgress },
    { label: 'Completed Today', value: summary.completedToday },
  ];

  return (
    <section className="dashboard-summary-grid" aria-label="Summary cards">
      {cards.map((card) => (
        <article className="dashboard-summary-card" key={card.label}>
          <p className="dashboard-summary-label">{card.label}</p>
          <p className="dashboard-summary-value">{card.value}</p>
        </article>
      ))}
    </section>
  );
};

export default DashboardSummaryCards;
