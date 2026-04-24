import { Archive, PlusCircle, PlayCircle, CheckCircle2, RotateCcw, Ghost } from 'lucide-react';
import { Link } from 'react-router-dom';
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
    <section className="dashboard-card" style={{ padding: '1.5rem' }}>
      <div className="dashboard-card-header" style={{ marginBottom: '1.5rem' }}>
        <h2 className="dashboard-card-title" style={{ fontSize: '1.125rem', letterSpacing: '-0.02em' }}>Task Status Pipeline</h2>
      </div>

      <div className="dashboard-kanban-grid" style={{ gap: '1.25rem', alignItems: 'flex-start' }}>
        {Object.keys(lanes).map((laneKey) => (
          <article key={laneKey} className="dashboard-lane" style={{ 
            minWidth: '0', 
            background: 'rgba(255,255,255,0.015)', 
            padding: '1rem', 
            borderRadius: '1rem',
            border: '1px solid rgba(255,255,255,0.03)'
          }}>
            <h3 style={{ 
              fontSize: '0.7rem', 
              fontWeight: '800',
              textTransform: 'uppercase', 
              letterSpacing: '0.1em', 
              color: 'var(--color-text-muted)', 
              marginBottom: '1rem', 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {laneTitle[laneKey]}
              <span style={{ 
                background: 'rgba(255,255,255,0.05)', 
                padding: '2px 8px', 
                borderRadius: '999px',
                fontSize: '0.625rem',
                fontVariantNumeric: 'tabular-nums'
              }}>{lanes[laneKey].length}</span>
            </h3>

            <div className="dashboard-lane-cards" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {lanes[laneKey].slice(0, 5).map(({ need, task }) => (
                <div key={need.id} className="dashboard-task-card" style={{ 
                  padding: '1rem', 
                  position: 'relative',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}>
                  {laneKey === 'completed' && (
                    <button 
                      onClick={() => onUpdateTask(task, 'archive')}
                      style={{ 
                        position: 'absolute', 
                        top: '0.75rem', 
                        right: '0.75rem', 
                        color: 'var(--color-text-muted)', 
                        opacity: 0.5,
                        transition: 'all 0.2s'
                      }}
                      className="hover:text-accent-rose hover:opacity-100"
                      title="Archive permanently"
                    >
                      <Archive size={14} />
                    </button>
                  )}
                  
                  <p style={{ 
                    fontSize: '0.8125rem', 
                    fontWeight: '700', 
                    lineHeight: '1.4', 
                    color: 'var(--color-text-primary)',
                    paddingRight: laneKey === 'completed' ? '1.5rem' : '0' 
                  }}>{need.title}</p>
                  
                  <p style={{ 
                    fontSize: '0.65rem', 
                    color: 'var(--color-text-muted)', 
                    marginTop: '0.35rem',
                    fontWeight: '500'
                  }}>
                    {task?.volunteer_name || 'Unassigned'}
                  </p>
                  
                  <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem' }}>
                    {laneKey === 'open' && (
                      <button type="button" className="dashboard-pill dashboard-pill-open" style={{ fontSize: '0.625rem', padding: '4px 10px', cursor: 'pointer' }} onClick={() => onDispatch(need)}>
                        <PlusCircle size={10} style={{ marginRight: '4px' }} />
                        Dispatch
                      </button>
                    )}
                    {laneKey === 'assigned' && task && (
                      <button type="button" className="dashboard-pill dashboard-pill-assigned" style={{ fontSize: '0.625rem', padding: '4px 10px', cursor: 'pointer' }} onClick={() => onUpdateTask(task, 'checkin')}>
                        <PlayCircle size={10} style={{ marginRight: '4px' }} />
                        Start
                      </button>
                    )}
                    {laneKey === 'in_progress' && task && (
                      <button type="button" className="dashboard-pill dashboard-pill-progress" style={{ fontSize: '0.625rem', padding: '4px 10px', cursor: 'pointer' }} onClick={() => onUpdateTask(task, 'complete')}>
                        <CheckCircle2 size={10} style={{ marginRight: '4px' }} />
                        Complete
                      </button>
                    )}
                    {laneKey === 'completed' && task && (
                      <button type="button" className="btn-ghost" style={{ fontSize: '0.625rem', padding: '4px 10px', height: 'auto', borderRadius: '99px' }} onClick={() => onUpdateTask(task, 'reopen')}>
                        <RotateCcw size={10} style={{ marginRight: '4px' }} />
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {lanes[laneKey].length > 5 && (
                <Link 
                  to="/needs-archive" 
                  style={{ 
                    fontSize: '0.65rem', 
                    color: 'var(--color-accent-sky)', 
                    textAlign: 'center', 
                    padding: '0.5rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                  className="hover:underline"
                >
                  + {lanes[laneKey].length - 5} More in Archive
                </Link>
              )}

              {lanes[laneKey].length === 0 && (
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '2rem 1rem',
                  border: '1px dashed rgba(255,255,255,0.05)',
                  borderRadius: '0.75rem',
                  opacity: 0.3
                }}>
                  <Ghost size={20} />
                  <p style={{ fontSize: '0.625rem', fontWeight: '600', textTransform: 'uppercase' }}>Empty</p>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default KanbanBoard;
