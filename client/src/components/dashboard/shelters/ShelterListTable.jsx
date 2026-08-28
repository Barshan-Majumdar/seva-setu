import {
  getShelterNeeds,
  RESOURCE_ICONS,
  getOccupancyPercent,
  getOccupancyColor,
  getOpenIncidentCount,
} from './shelterMockData';

/**
 * ShelterListTable
 * ----------------
 * Shelter list table with checkbox multi-select.
 * Mirrors NeedsList.jsx structure exactly:
 *   dashboard-card → dashboard-card-header → dashboard-needs-table-wrap → dashboard-needs-table
 *
 * Receives all state via props (no context).
 */
const ShelterListTable = ({ shelters, selectedIds, toggleSelect, isMaxed, sorting, setSort }) => {
  const sortable = [
    { key: 'name', label: 'Shelter Name' },
    { key: 'ward', label: 'Ward' },
    { key: 'district', label: 'District' },
    { key: 'status', label: 'Status' },
    { key: 'occupancy', label: 'Occupancy' },
    { key: 'incidents', label: 'Incidents' },
  ];

  return (
    <section className="dashboard-card">
      <div className="dashboard-card-header">
        <h2 className="dashboard-card-title">Shelter List</h2>
        <span style={{
          fontSize: '0.675rem', fontWeight: 700, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {shelters.length} shelters
        </span>
      </div>

      <div className="dashboard-needs-table-wrap">
        <table className="dashboard-needs-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                {/* Checkbox header — no select-all to keep it simple */}
              </th>
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
              <th>Resources</th>
            </tr>
          </thead>
          <tbody>
            {shelters.map((shelter) => {
              const isSelected = selectedIds.includes(shelter.id);
              const percent = getOccupancyPercent(shelter);
              const color = getOccupancyColor(percent);
              const needs = getShelterNeeds(shelter);
              const openIncidents = getOpenIncidentCount(shelter);

              return (
                <tr
                  key={shelter.id}
                  className={isSelected ? 'is-selected' : ''}
                  onClick={() => toggleSelect(shelter.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Checkbox */}
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(shelter.id)}
                      disabled={!isSelected && isMaxed}
                      style={{ cursor: !isSelected && isMaxed ? 'not-allowed' : 'pointer', accentColor: '#2d6148' }}
                    />
                  </td>

                  {/* Name */}
                  <td>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                      {shelter.name}
                    </span>
                  </td>

                  {/* Ward */}
                  <td>{shelter.ward}</td>

                  {/* District */}
                  <td>{shelter.district}</td>

                  {/* Status */}
                  <td>
                    <span className={`dashboard-pill dashboard-pill-${shelter.status}`}>
                      {shelter.status}
                    </span>
                  </td>

                  {/* Occupancy */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        color: color === 'red' ? '#dc2626' : color === 'amber' ? '#d97706' : '#059669',
                        fontSize: '0.8125rem',
                      }}>
                        {shelter.occupancyCurrent}/{shelter.capacityTotal}
                      </span>
                      <div className="shelter-occupancy-bar" style={{ width: '60px' }}>
                        <div
                          className={`shelter-occupancy-fill shelter-occupancy-${color}`}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Incidents */}
                  <td>
                    {openIncidents > 0 ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 22, height: 22, borderRadius: '6px',
                        background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626',
                        fontSize: '0.7rem', fontWeight: 800, padding: '0 6px',
                      }}>
                        {openIncidents}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>0</span>
                    )}
                  </td>

                  {/* Resources */}
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {needs.map((res) => (
                        <span
                          key={res.category}
                          className={`shelter-resource-chip shelter-resource-${res.status}`}
                        >
                          {RESOURCE_ICONS[res.category]} {res.status.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ShelterListTable;
