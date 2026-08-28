import { X, GitCompare, Copy, Check, ArrowDownWideNarrow } from 'lucide-react';
import { useState } from 'react';
import ShelterCompareCard from './ShelterCompareCard';
import {
  getShelterNeeds,
  RESOURCE_ICONS,
  getOccupancyPercent,
  getOccupancyColor,
  getOpenIncidentCount,
} from './shelterMockData';

/**
 * ShelterCompareModal
 * -------------------
 * Full comparison modal. Uses "dashboard-modal card shelter-compare"
 * (two base classes matching MatchModal's "dashboard-modal card", plus wider variant).
 *
 * Layout:
 *  - ≤4 shelters → CSS grid of ShelterCompareCard components
 *  - 5-10 shelters → dense comparison table (rows = shelters, cols = attributes)
 *
 * TODO: Real-time socket updates inside Compare View are not implemented for v1.
 * This renders a static snapshot on open, which is acceptable per spec.
 */
const ShelterCompareModal = ({
  selectedShelters,
  compareAggregates,
  compareSortKey,
  setCompareSortKey,
  closeCompare,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopySummary = async () => {
    const lines = selectedShelters.map((s, i) => {
      const percent = getOccupancyPercent(s);
      const needs = getShelterNeeds(s);
      const issues = needs
        .filter((n) => n.status !== 'ok')
        .map((n) => `${n.category[0].toUpperCase() + n.category.slice(1)}: ${n.status.toUpperCase()}`)
        .join(', ');
      const incidents = getOpenIncidentCount(s);
      const statusLabel = s.status === 'full' ? 'FULL' : `${percent}%`;

      return `${i + 1}. ${s.name} — ${s.occupancyCurrent}/${s.capacityTotal} (${statusLabel})${issues ? ` — ${issues}` : ''}${incidents > 0 ? ` — ${incidents} incident${incidents > 1 ? 's' : ''}` : ''}`;
    });

    const summary = `Shelter Comparison — ${selectedShelters.length} sites, ${compareAggregates.totalPeople.toLocaleString()} people\n${lines.join('\n')}`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[ShelterCompare] Clipboard write failed:', err);
    }
  };

  const useTableLayout = selectedShelters.length > 4;

  return (
    <div className="dashboard-modal-backdrop" role="dialog" aria-modal="true" onClick={closeCompare}>
      <div className="dashboard-modal card shelter-compare" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="dashboard-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(45, 97, 72, 0.07)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <GitCompare size={16} style={{ color: '#2d6148' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Compare Shelters ({selectedShelters.length})
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0, marginTop: '0.1rem' }}>
                Side-by-side comparison of selected shelters
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCompare}
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

        {/* ── Aggregate Summary Strip ─────────────────────────── */}
        <div style={{
          padding: '0.875rem 1rem', background: '#fafbfc',
          borderRadius: '10px', border: '1px solid rgba(0, 0, 0, 0.04)',
          marginBottom: '1.25rem',
          display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
              Total People
            </span>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
              {compareAggregates.totalPeople.toLocaleString()}
            </p>
          </div>
          <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.06)' }} />
          <div>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
              Open Needs
            </span>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: compareAggregates.totalOpenNeeds > 0 ? '#d97706' : '#059669', margin: 0 }}>
              {compareAggregates.totalOpenNeeds}
            </p>
          </div>
          <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.06)' }} />
          <div>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
              Open Incidents
            </span>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: compareAggregates.totalIncidents > 0 ? '#dc2626' : '#059669', margin: 0 }}>
              {compareAggregates.totalIncidents}
            </p>
          </div>
          {compareAggregates.urgentResource && (
            <>
              <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.06)' }} />
              <div style={{
                padding: '0.4rem 0.6rem', borderRadius: '8px',
                background: 'rgba(220, 38, 38, 0.06)', border: '1px solid rgba(220, 38, 38, 0.12)',
              }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#dc2626' }}>
                  Most Critical
                </span>
                <p style={{ fontSize: '0.8rem', fontWeight: 650, color: '#0f172a', margin: 0, marginTop: '0.1rem' }}>
                  {compareAggregates.urgentResource.shelterName} — {RESOURCE_ICONS[compareAggregates.urgentResource.category]}{' '}
                  {compareAggregates.urgentResource.category}: {compareAggregates.urgentResource.status.toUpperCase()}
                  {compareAggregates.urgentResource.hoursRemaining != null && compareAggregates.urgentResource.hoursRemaining > 0 && (
                    <span style={{ color: '#dc2626' }}> ({compareAggregates.urgentResource.hoursRemaining}h remaining)</span>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Sort Controls ───────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          marginBottom: '1rem',
        }}>
          <ArrowDownWideNarrow size={14} style={{ color: '#94a3b8' }} />
          <span style={{ fontSize: '0.675rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
            Sort by
          </span>
          <select
            value={compareSortKey}
            onChange={(e) => setCompareSortKey(e.target.value)}
            style={{
              fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.6rem',
              borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)',
              background: '#ffffff', color: '#334155', cursor: 'pointer',
            }}
          >
            <option value="occupancy">Occupancy %</option>
            <option value="critical">Most Critical Need</option>
            <option value="name">Name (A→Z)</option>
            <option value="incidents">Open Incidents</option>
          </select>
        </div>

        {/* ── Cards or Table ──────────────────────────────────── */}
        {useTableLayout ? (
          <div className="dashboard-needs-table-wrap" style={{ marginBottom: '1.25rem' }}>
            <table className="dashboard-needs-table">
              <thead>
                <tr>
                  <th>Shelter</th>
                  <th>Status</th>
                  <th>Occupancy</th>
                  <th>🍚 Food</th>
                  <th>🚰 Water</th>
                  <th>🩹 Medical</th>
                  <th>🛏️ Bedding</th>
                  <th>Incidents</th>
                </tr>
              </thead>
              <tbody>
                {selectedShelters.map((shelter) => {
                  const percent = getOccupancyPercent(shelter);
                  const color = getOccupancyColor(percent);
                  const needs = getShelterNeeds(shelter);
                  const openIncidents = getOpenIncidentCount(shelter);
                  const needsMap = {};
                  needs.forEach((n) => { needsMap[n.category] = n; });

                  return (
                    <tr key={shelter.id}>
                      <td>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 650, color: '#0f172a' }}>
                            {shelter.name}
                          </span>
                          <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: 0, marginTop: '0.1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {shelter.ward} • {shelter.district}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className={`dashboard-pill dashboard-pill-${shelter.status}`}>
                          {shelter.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem',
                            color: color === 'red' ? '#dc2626' : color === 'amber' ? '#d97706' : '#059669',
                          }}>
                            {percent}%
                          </span>
                          <div className="shelter-occupancy-bar" style={{ width: '50px' }}>
                            <div
                              className={`shelter-occupancy-fill shelter-occupancy-${color}`}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      {['food', 'water', 'medical', 'bedding'].map((cat) => {
                        const res = needsMap[cat];
                        if (!res) return <td key={cat}>-</td>;
                        return (
                          <td key={cat}>
                            <span className={`shelter-resource-chip shelter-resource-${res.status}`}>
                              {res.status.toUpperCase()}
                              {res.status === 'low' && res.hoursRemaining != null && (
                                <span style={{ opacity: 0.8, marginLeft: '2px' }}>({res.hoursRemaining}h)</span>
                              )}
                            </span>
                          </td>
                        );
                      })}
                      <td>
                        {openIncidents > 0 ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 22, height: 22, borderRadius: '6px',
                            background: 'rgba(220,38,38,0.1)', color: '#dc2626',
                            fontSize: '0.7rem', fontWeight: 800, padding: '0 6px',
                          }}>
                            {openIncidents}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.875rem',
            marginBottom: '1.25rem',
          }}>
            {selectedShelters.map((shelter) => (
              <ShelterCompareCard key={shelter.id} shelter={shelter} />
            ))}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: '1rem', borderTop: '1px solid rgba(0, 0, 0, 0.05)',
        }}>
          <button
            type="button"
            className="dashboard-dispatch-btn-premium"
            onClick={handleCopySummary}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            {copied ? <Check size={14} style={{ color: '#059669' }} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Summary'}
          </button>
          <button
            type="button"
            className="dashboard-dispatch-btn-premium"
            onClick={closeCompare}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShelterCompareModal;
