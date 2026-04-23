import { formatElapsed } from '../../utils/dashboard';

const StatusPill = ({ status }) => (
  <span className={`dashboard-pill dashboard-pill-${status}`}>{status.replace('_', ' ')}</span>
);

const NeedsList = ({
  needs,
  selectedNeedId,
  setSelectedNeedId,
  sorting,
  setSort,
  onDispatch,
}) => {
  const sortable = [
    { key: 'ward', label: 'Ward' },
    { key: 'need_type', label: 'Need Type' },
    { key: 'urgency_score', label: 'Urgency' },
    { key: 'people_affected', label: 'People' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Reported' },
  ];

  return (
    <section className="dashboard-card">
      <div className="dashboard-card-header">
        <h2 className="dashboard-card-title">Needs List</h2>
      </div>

      <div className="dashboard-needs-table-wrap">
        <table className="dashboard-needs-table">
          <thead>
            <tr>
              {sortable.map((col) => (
                <th key={col.key}>
                  <button
                    type="button"
                    className="dashboard-th-btn"
                    onClick={() => setSort(col.key)}
                  >
                    {col.label}
                    {sorting.key === col.key ? (sorting.direction === 'asc' ? ' ?' : ' ?') : ''}
                  </button>
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {needs.map((need) => (
              <tr
                key={need.id}
                className={selectedNeedId === need.id ? 'is-selected' : ''}
                onClick={() => setSelectedNeedId(need.id)}
              >
                <td>{need.ward || '-'}</td>
                <td className="capitalize">{need.need_type}</td>
                <td>{Number(need.urgency_score || 0).toFixed(2)}</td>
                <td>{need.people_affected || 0}</td>
                <td>
                  <StatusPill status={need.status} />
                </td>
                <td>{formatElapsed(need.created_at)}</td>
                <td>
                  <button
                    type="button"
                    className="dashboard-dispatch-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDispatch(need);
                    }}
                    disabled={need.status !== 'open'}
                  >
                    Dispatch
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default NeedsList;
