import { formatElapsed } from '../../utils/dashboard';

const laneTitle = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const KanbanBoard = ({ needs, tasks, onDispatch, onUpdateTask }) => {
  const tasksByNeedId = tasks.reduce((acc, task) => {
    acc[task.need_id] = task;
    return acc;
  }, {});

  const lanes = {
    open: [],
    assigned: [],
    in_progress: [],
    completed: [],
  };

  needs.forEach((need) => {
    const task = tasksByNeedId[need.id];
    const status = need.status;
    if (!lanes[status]) return;

    lanes[status].push({
      need,
      task,
    });
  });

  return (
    <section className="dashboard-card">
      <div className="dashboard-card-header">
        <h2 className="dashboard-card-title">Task Status Pipeline</h2>
      </div>

      <div className="dashboard-kanban-grid">
        {Object.keys(lanes).map((laneKey) => (
          <article key={laneKey} className="dashboard-lane">
            <h3>{laneTitle[laneKey]}</h3>
            <div className="dashboard-lane-cards">
              {lanes[laneKey].map(({ need, task }) => (
                <div key={need.id} className="dashboard-task-card">
                  <p className="font-semibold text-sm">{need.title}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    Volunteer: {task?.volunteer_name || 'Unassigned'}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Elapsed: {formatElapsed(task?.assigned_at || need.created_at)}
                  </p>

                  <div className="dashboard-task-actions mt-3">
                    {laneKey === 'open' ? (
                      <button type="button" className="dashboard-text-btn" onClick={() => onDispatch(need)}>
                        Dispatch
                      </button>
                    ) : null}
                    {laneKey === 'assigned' && task ? (
                      <button type="button" className="dashboard-text-btn" onClick={() => onUpdateTask(task, 'checkin')}>
                        Mark In Progress
                      </button>
                    ) : null}
                    {laneKey === 'in_progress' && task ? (
                      <button type="button" className="dashboard-text-btn" onClick={() => onUpdateTask(task, 'complete')}>
                        Mark Complete
                      </button>
                    ) : null}
                    {laneKey === 'completed' && task ? (
                      <button type="button" className="dashboard-text-btn" onClick={() => onUpdateTask(task, 'reopen')}>
                        Reopen
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}

              {lanes[laneKey].length === 0 ? (
                <p className="text-xs text-text-muted">No cards.</p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default KanbanBoard;
