import { useState } from 'react';
import { formatElapsed } from '../../utils/dashboard';
import { Trash2 } from 'lucide-react';
import api from '../../services/api';

const StatusPill = ({ status }) => (
  <span className={`dashboard-pill dashboard-pill-${status}`}>{status.replace('_', ' ')}</span>
);

const PriorityBadge = ({ level = 'Medium', factors = [] }) => {
  const normLevel = (level || 'Medium').toLowerCase();
  const styles = {
    high: {
      bg: 'rgba(239, 68, 68, 0.1)',
      text: '#dc2626',
      border: 'rgba(239, 68, 68, 0.3)',
      dot: '#ef4444',
      label: 'High',
    },
    medium: {
      bg: 'rgba(245, 158, 11, 0.1)',
      text: '#d97706',
      border: 'rgba(245, 158, 11, 0.3)',
      dot: '#f59e0b',
      label: 'Medium',
    },
    low: {
      bg: 'rgba(100, 116, 139, 0.08)',
      text: '#475569',
      border: 'rgba(100, 116, 139, 0.25)',
      dot: '#94a3b8',
      label: 'Low',
    },
  };
  const style = styles[normLevel] || styles.medium;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '0.7rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: style.dot,
          boxShadow: normLevel === 'high' ? '0 0 6px #ef4444' : 'none',
        }} />
        {style.label}
      </span>

      {Array.isArray(factors) && factors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', maxWidth: '140px' }}>
          {factors.slice(0, 2).map((factor, idx) => (
            <span
              key={idx}
              title={factor}
              style={{
                fontSize: '0.58rem',
                fontWeight: 700,
                color: style.text,
                background: 'rgba(0,0,0,0.03)',
                padding: '1px 4px',
                borderRadius: '3px',
                border: '1px solid rgba(0,0,0,0.06)',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                maxWidth: '130px',
              }}
            >
              ⚡ {factor}
            </span>
          ))}
          {factors.length > 2 && (
            <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700 }}>
              +{factors.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const NeedsList = ({
  needs,
  selectedNeedId,
  setSelectedNeedId,
  sorting,
  setSort,
  onDispatch,
  onDelete,
}) => {

  const handleDelete = (e, needId) => {
    e.stopPropagation();
    e.preventDefault();
    
    // NO confirm dialog — delete instantly on click
    console.log("STEP 1: handleDelete called for:", needId);
    console.log("STEP 2: onDelete is:", typeof onDelete);
    
    // Remove from UI INSTANTLY
    if (onDelete) {
      console.log("STEP 3: Calling onDelete NOW");
      onDelete(needId);
      console.log("STEP 4: onDelete returned");
    } else {
      console.error("STEP 3 FAIL: onDelete is undefined!");
    }

    // Fire-and-forget API call in the background
    api.delete('/needs/' + needId)
      .then(() => console.log("STEP 5: Server delete success for", needId))
      .catch(err => console.error("STEP 5 FAIL: Server delete error:", err));
  };

  const sortable = [
    { key: 'priority_level', label: 'Priority' },
    { key: 'district', label: 'District' },
    { key: 'ward', label: 'Ward' },
    { key: 'need_type', label: 'Type' },
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
              <th>Issue</th>
              {sortable.map((col) => (
                <th key={col.key}>
                  <button
                    type="button"
                    className="dashboard-th-btn"
                    onClick={() => setSort(col.key)}
                  >
                    {col.label}
                    {sorting.key === col.key ? (sorting.direction === 'asc' ? ' ↑' : ' ↓') : ''}
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
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>


                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {need.title?.startsWith('WA:') && (
                          <span style={{ background: '#25D366', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '900', letterSpacing: '0.5px' }}>
                            WA
                          </span>
                        )}
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                          {need.title?.replace(/^WA:\s*/, '') || 'Unknown Issue'}
                        </span>
                      </div>
                    </div>

                    {(need.status === 'completed' || need.status === 'rejected') && (
                      <button
                        type="button"
                        title="Delete Permanently"
                        onClick={(e) => handleDelete(e, need.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          borderRadius: '8px',
                          background: 'rgba(244, 63, 94, 0.15)',
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                          color: '#fb7185',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  <PriorityBadge
                    level={need.priority_level}
                    factors={need.vulnerability_factors}
                  />
                </td>
                <td>{need.district || '-'}</td>
                <td>{need.ward || '-'}</td>
                <td className="capitalize">{need.need_type}</td>
                <td>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: Number(need.urgency_score || 0) > 7 ? '#c35d51' : '#0f172a' }}>{Number(need.urgency_score || 0).toFixed(1)}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{need.people_affected || 0}</span>
                    {(Number(need.children_count) > 0 || Number(need.adults_count) > 0 || Number(need.pregnant_count) > 0) && (
                      <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>
                        {Number(need.children_count) > 0 && `👶 ${need.children_count}c `}
                        {Number(need.adults_count) > 0 && `🧑 ${need.adults_count}a `}
                        {Number(need.pregnant_count) > 0 && `🤰 ${need.pregnant_count}p`}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-1.5 items-start">
                    <StatusPill status={need.status} />
                    {Number(need.pending_broadcasts) > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent-rose/10 text-accent-rose border border-accent-rose/20 animate-pulse">
                        <svg xmlns="http://www.w3.org/0000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                        {Number(need.pending_broadcasts)} Notified
                      </span>
                    )}
                  </div>
                </td>
                <td>{formatElapsed(need.created_at)}</td>
                <td>
                  {(need.status === 'open' || need.status === 'pending') && (
                    <button
                      type="button"
                      className="dashboard-dispatch-btn-premium primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDispatch(need);
                      }}
                      style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem' }}
                    >
                      Dispatch
                    </button>
                  )}
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
