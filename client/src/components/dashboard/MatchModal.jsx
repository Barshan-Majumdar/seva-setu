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
          <p style={{ fontSize: '0.875rem', fontWeight: 650, color: '#0f172a', margin: 0, marginBottom: '0.2rem' }}>
            {need.title}
          </p>
          <p style={{ fontSize: '0.675rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', margin: 0 }}>
            {need.ward || 'Unknown'} • {need.district || 'Unspecified'}
          </p>
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
