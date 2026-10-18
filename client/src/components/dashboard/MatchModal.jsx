import { MapPin, X, AlertTriangle, Loader2 } from 'lucide-react';

const MatchModal = ({
  need,
  matches,
  loading,
  assigningVolunteerId,
  onClose,
  onAssign,
}) => {
  if (!need) return null;

  return (
    <div className="dashboard-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="dashboard-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(45, 97, 72, 0.07)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <MapPin size={16} style={{ color: '#2d6148' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Dispatch Volunteers
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0, marginTop: '0.1rem' }}>
                Select a volunteer to assign this need
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.04)', border: '1px solid rgba(0, 0, 0, 0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#94a3b8', transition: 'all 200ms',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{
          padding: '0.875rem 1rem', background: '#fafbfc',
          borderRadius: '10px', border: '1px solid rgba(0, 0, 0, 0.04)',
          marginBottom: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 650, color: '#0f172a', margin: 0 }}>
              {need.title}
            </p>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              background: need.priority_level === 'High' ? '#fee2e2' : need.priority_level === 'Medium' ? '#fef3c7' : '#e2e8f0',
              color: need.priority_level === 'High' ? '#b91c1c' : need.priority_level === 'Medium' ? '#b45309' : '#334155',
              border: `1px solid ${need.priority_level === 'High' ? '#fca5a5' : need.priority_level === 'Medium' ? '#fcd34d' : '#cbd5e1'}`,
              whiteSpace: 'nowrap',
            }}>
              {need.priority_level || 'Medium'} Priority
            </span>
          </div>

          <p style={{ fontSize: '0.675rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', margin: 0 }}>
            {need.ward || 'Unknown'} • {need.district || 'Unspecified'} • {need.need_type}
            {Number(need.urgency_score) > 0 && ` • Urgency: ${Number(need.urgency_score).toFixed(1)}/10`}
          </p>

          {(Number(need.children_count) > 0 || Number(need.adults_count) > 0 || Number(need.pregnant_count) > 0 || (Array.isArray(need.vulnerability_factors) && need.vulnerability_factors.length > 0)) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '0.5rem' }}>
              {Number(need.children_count) > 0 && (
                <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.08)', color: '#b91c1c', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  👶 {need.children_count} {Number(need.children_count) === 1 ? 'Child' : 'Children'}
                </span>
              )}
              {Number(need.pregnant_count) > 0 && (
                <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.1)', color: '#be185d', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                  🤰 {need.pregnant_count} {Number(need.pregnant_count) === 1 ? 'Pregnant Woman' : 'Pregnant Women'}
                </span>
              )}
              {Number(need.adults_count) > 0 && (
                <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(71, 85, 105, 0.08)', color: '#475569', border: '1px solid rgba(71, 85, 105, 0.2)' }}>
                  🧑 {need.adults_count} Adults
                </span>
              )}
              {Array.isArray(need.vulnerability_factors) && need.vulnerability_factors.map((f, i) => (
                <span key={i} style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  ⚡ {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {Number(need.pending_broadcasts) > 0 && (
          <div style={{
            marginBottom: '1.25rem', padding: '0.875rem 1rem',
            borderRadius: '10px', background: 'rgba(244, 63, 94, 0.04)',
            border: '1px solid rgba(244, 63, 94, 0.12)',
            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
          }}>
            <AlertTriangle size={16} style={{ color: '#f43f5e', flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, marginBottom: '0.25rem' }}>
                Broadcast Active
              </p>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                {Number(need.pending_broadcasts)} volunteers notified. Manual assignment will override the broadcast.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1.5rem 0', justifyContent: 'center', color: '#94a3b8' }}>
            <Loader2 size={16} className="icon-spin" />
            <span style={{ fontSize: '0.85rem' }}>Loading ranked volunteers...</span>
          </div>
        ) : (
          <div className="dashboard-match-list">
            {matches.map((vol) => (
              <article key={vol.id} className="dashboard-match-card">
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 650, color: '#0f172a', margin: 0, marginBottom: '0.3rem' }}>
                    {vol.name}
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                    <span>{Number(vol.distance_km || 0).toFixed(2)} km</span>
                    <span>•</span>
                    <span>{Math.round((vol.completion_rate || 0) * 100)}% completion</span>
                  </div>
                  <div className="dashboard-tag-row" style={{ marginTop: '0.5rem' }}>
                    {(vol.skills || []).map((skill) => (
                      <span key={skill} className="dashboard-tag">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="dashboard-dispatch-btn-premium primary"
                  onClick={() => onAssign(vol.id)}
                  disabled={assigningVolunteerId === vol.id}
                  style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
                >
                  {assigningVolunteerId === vol.id ? 'Assigning...' : 'Assign'}
                </button>
              </article>
            ))}

            {!loading && matches.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '2rem',
                color: '#94a3b8', fontSize: '0.85rem',
              }}>
                No available volunteers matched this need.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchModal;
