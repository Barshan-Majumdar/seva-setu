import { ACTIVE_TEAMS, PRIORITY_QUEUE } from './content';

const urgencyClass = (urgency) => {
  if (urgency === 'Critical') return 'text-accent-rose';
  if (urgency === 'High') return 'text-accent-amber';
  return 'text-accent-sky';
};

const OperationsPanels = () => (
  <section className="dashboard-panel-grid">
    <article className="dashboard-panel">
      <header>
        <p className="dashboard-panel-label">Priority Queue</p>
        <h2>Needs awaiting dispatch confirmation</h2>
      </header>
      <ul className="dashboard-list">
        {PRIORITY_QUEUE.map((item) => (
          <li key={item.id}>
            <div>
              <p className="font-semibold text-text-primary">{item.id} - {item.location}</p>
              <p className="text-sm text-text-secondary">{item.type} - {item.eta}</p>
            </div>
            <span className={`text-xs font-semibold uppercase tracking-[0.08em] ${urgencyClass(item.urgency)}`}>
              {item.urgency}
            </span>
          </li>
        ))}
      </ul>
    </article>

    <article className="dashboard-panel">
      <header>
        <p className="dashboard-panel-label">Responder Lanes</p>
        <h2>Teams currently active in field zones</h2>
      </header>
      <ul className="dashboard-list">
        {ACTIVE_TEAMS.map((team) => (
          <li key={team.name}>
            <div>
              <p className="font-semibold text-text-primary">{team.name}</p>
              <p className="text-sm text-text-secondary">{team.zone}</p>
            </div>
            <span className="text-xs font-semibold text-accent-green uppercase tracking-[0.08em]">{team.status}</span>
          </li>
        ))}
      </ul>
    </article>
  </section>
);

export default OperationsPanels;

