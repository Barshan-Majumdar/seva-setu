import { Trash2, PlusCircle, CheckCircle2, RotateCcw, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const laneConfig = {
  open: { title: 'Open', color: '#059669', dotBg: 'rgba(5, 150, 105, 0.15)' },
  assigned: { title: 'Assigned', color: '#d97706', dotBg: 'rgba(217, 119, 6, 0.15)' },
  in_progress: { title: 'In Progress', color: '#2d6148', dotBg: 'rgba(45, 97, 72, 0.15)' },
  completed: { title: 'Completed', color: '#475569', dotBg: 'rgba(71, 85, 105, 0.1)' },
};

const KanbanBoard = ({ needs, tasks, onDispatch, onUpdateTask, onDelete }) => {

  const handleDelete = (needId) => {
    if (onDelete) {
      onDelete(needId);
    }
    api.delete('/needs/' + needId).catch(err => console.error("Delete error:", err));
  };

  const tasksByNeedId = tasks.reduce((acc, task) => {
    acc[task.need_id] = task;
    return acc;
  }, {});

  const lanes = { open: [], assigned: [], in_progress: [], completed: [] };

  needs.forEach((need) => {
    const task = tasksByNeedId[need.id];
    let laneStatus = need.status;
    if (laneStatus === 'pending') laneStatus = 'open';
    if (!lanes[laneStatus]) return;
    lanes[laneStatus].push({ need, task });
  });

  return (
    <section className="dashboard-card" style={{ padding: '1.5rem' }}>
      <div className="dashboard-card-header" style={{ marginBottom: '1.25rem' }}>
        <h2 className="dashboard-card-title" style={{ fontSize: '1.05rem' }}>Task Pipeline</h2>
      </div>

      <div className="dashboard-kanban-grid" style={{ alignItems: 'flex-start' }}>
        {Object.keys(lanes).map((laneKey) => {
          const config = laneConfig[laneKey];
          return (
            <article key={laneKey} className="dashboard-lane">
              <h3 style={{
                fontSize: '0.675rem', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '0.85rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: config.color, display: 'inline-block',
                  }} />
                  {config.title}
                </span>
                <span style={{
                  background: 'rgba(0, 0, 0, 0.04)', padding: '2px 8px',
                  borderRadius: '6px', fontSize: '0.6rem', fontVariantNumeric: 'tabular-nums',
                  fontWeight: 700, color: '#64748b',
                }}>
                  {lanes[laneKey].length}
                </span>
              </h3>

              <div className="dashboard-lane-cards" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {lanes[laneKey].slice(0, 5).map(({ need, task }) => (
                  <div key={need.id} className="dashboard-task-card" style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      {need.title?.toLowerCase().includes('whatsapp') && (
                        <span style={{
                          background: '#25D366', color: 'white', padding: '1px 5px',
                          borderRadius: '4px', fontSize: '8px', fontWeight: 900,
                        }}>WA</span>
                      )}
                      {task?.is_verified && (
                        <CheckCircle2 size={13} style={{ color: '#059669', flexShrink: 0 }} title="AI Verified" />
                      )}
                      <p style={{
                        fontSize: '0.8rem', fontWeight: 650, lineHeight: 1.4,
                        color: '#0f172a', margin: 0,
                      }}>
                        {need.title}
                      </p>
                    </div>

                    <p style={{
                      fontSize: '0.675rem', color: '#94a3b8', marginTop: '0.25rem',
                      fontWeight: 500, margin: 0,
                    }}>
                      {task?.volunteer_name || 'Unassigned'}
                    </p>

                    <p style={{
                      fontSize: '0.6rem', color: '#64748b', marginTop: '0.15rem',
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                      margin: 0,
                    }}>
                      {need.ward || 'Unknown'} • {need.district || 'Unspecified'}
                    </p>

                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {laneKey === 'open' && (
                        <button
                          type="button"
                          className="dashboard-pill dashboard-pill-open"
                          style={{ fontSize: '0.6rem', padding: '3px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          onClick={() => onDispatch(need)}
                        >
                          <PlusCircle size={10} />
                          Dispatch
                        </button>
                      )}

                      {laneKey === 'completed' && task && (
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ fontSize: '0.6rem', padding: '3px 8px', height: 'auto', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          onClick={() => onUpdateTask(task, 'reopen')}
                        >
                          <RotateCcw size={10} />
                          Reopen
                        </button>
                      )}
                      {laneKey === 'completed' && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(need.id);
                          }}
                          style={{
                            fontSize: '0.6rem', padding: '3px 8px', height: 'auto',
                            borderRadius: '6px', border: '1px solid rgba(195, 93, 81, 0.2)',
                            background: 'rgba(195, 93, 81, 0.05)', color: '#c35d51',
                            position: 'relative', zIndex: 10, display: 'inline-flex',
                            alignItems: 'center', gap: '3px',
                          }}
                        >
                          <Trash2 size={10} style={{ pointerEvents: 'none' }} />
                          <span style={{ pointerEvents: 'none' }}>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {lanes[laneKey].length > 5 && (
                  <Link
                    to="/needs-archive"
                    style={{
                      fontSize: '0.65rem', color: '#2d6148', textAlign: 'center',
                      padding: '0.5rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.04em', display: 'block',
                    }}
                  >
                    + {lanes[laneKey].length - 5} More
                  </Link>
                )}

                {lanes[laneKey].length === 0 && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '0.5rem', padding: '1.75rem 1rem',
                    border: '1px dashed rgba(0, 0, 0, 0.08)', borderRadius: '10px',
                  }}>
                    <Inbox size={20} style={{ color: '#cbd5e1' }} />
                    <p style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', color: '#cbd5e1', margin: 0 }}>Empty</p>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default KanbanBoard;
