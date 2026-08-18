import {
  getShelterNeeds,
  RESOURCE_ICONS,
  getOccupancyPercent,
  getOccupancyColor,
  getOpenIncidentCount,
} from './shelterMockData';

/**
 * ShelterCompareCard
 * ------------------
 * Single shelter card used in the ≤4 grid layout inside ShelterCompareModal.
 * Props: { shelter, needs } where needs = getShelterNeeds(shelter).
 */
const ShelterCompareCard = ({ shelter }) => {
  const needs = getShelterNeeds(shelter);
  const percent = getOccupancyPercent(shelter);
  const color = getOccupancyColor(percent);
  const openIncidents = getOpenIncidentCount(shelter);

  return (
    <div className="shelter-compare-card">
      {/* Name + Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            {shelter.name}
          </p>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', margin: 0, marginTop: '0.15rem' }}>
            {shelter.ward} • {shelter.district}
          </p>
        </div>
        <span className={`dashboard-pill dashboard-pill-${shelter.status}`}>
          {shelter.status}
        </span>
      </div>

      {/* Occupancy bar */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '0.675rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Occupancy
          </span>
          <span style={{
            fontSize: '0.8rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: color === 'red' ? '#dc2626' : color === 'amber' ? '#d97706' : '#059669',
          }}>
            {shelter.occupancyCurrent}/{shelter.capacityTotal} ({percent}%)
          </span>
        </div>
        <div className="shelter-occupancy-bar">
          <div
            className={`shelter-occupancy-fill shelter-occupancy-${color}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>

      {/* Resource chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
        {needs.map((res) => (
          <span
            key={res.category}
            className={`shelter-resource-chip shelter-resource-${res.status}`}
          >
            {RESOURCE_ICONS[res.category] || '📦'} {res.category} {res.status.toUpperCase()}
            {res.status === 'low' && res.hoursRemaining != null && (
              <span style={{ opacity: 0.8, marginLeft: '2px' }}>({res.hoursRemaining}h)</span>
            )}
          </span>
        ))}
      </div>

      {/* Incidents */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {openIncidents > 0 ? (
            <>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626',
                fontSize: '0.65rem', fontWeight: 800,
              }}>
                {openIncidents}
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#dc2626' }}>
                {openIncidents === 1 ? 'incident' : 'incidents'}
              </span>
            </>
          ) : (
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8' }}>
              No incidents
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            // TODO: navigate to single-shelter detail panel when built
            console.log(`[ShelterCompare] View full shelter: ${shelter.id}`);
          }}
          style={{
            fontSize: '0.65rem', fontWeight: 700, color: '#2d6148',
            background: 'transparent', border: 'none', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}
        >
          View Full →
        </button>
      </div>
    </div>
  );
};

export default ShelterCompareCard;
