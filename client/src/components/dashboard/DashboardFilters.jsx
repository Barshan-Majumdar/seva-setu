import { SlidersHorizontal, X } from 'lucide-react';

const DashboardFilters = ({ filters, setFilters, districts, sorting, setSort }) => {
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const hasActiveFilters = filters.status !== 'all' || filters.needType !== 'all' || filters.district !== 'all' || (sorting?.key && sorting.key !== 'urgency_score');

  return (
    <section className="dashboard-sidebar-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <SlidersHorizontal size={14} style={{ color: '#94a3b8' }} />
          <h2 className="dashboard-card-title" style={{ marginBottom: 0, fontSize: '0.9rem' }}>Filters</h2>
        </div>
        {hasActiveFilters && (
          <span style={{
            fontSize: '0.575rem', fontWeight: 800, color: '#2d6148',
            background: 'rgba(45, 97, 72, 0.08)', padding: '2px 6px',
            borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>Active</span>
        )}
      </div>

      {/* Sort By */}
      <div>
        <label className="dashboard-filter-label" htmlFor="sort-filter">Sort By</label>
        <select
          id="sort-filter"
          className="input-field"
          value={sorting?.key || 'urgency_score'}
          onChange={(e) => setSort(e.target.value)}
          style={{ cursor: 'pointer', width: '100%', marginTop: '0.3rem' }}
        >
          <option value="urgency_score">Highest Urgency</option>
          <option value="created_at">Most Recent</option>
        </select>
      </div>

      {/* Status */}
      <div>
        <label className="dashboard-filter-label" htmlFor="status-filter">Status</label>
        <select
          id="status-filter"
          className="input-field"
          value={filters.status}
          onChange={(e) => update('status', e.target.value)}
          style={{ cursor: 'pointer', width: '100%', marginTop: '0.3rem' }}
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Need Type */}
      <div>
        <label className="dashboard-filter-label" htmlFor="type-filter">Need Type</label>
        <select
          id="type-filter"
          className="input-field"
          value={filters.needType}
          onChange={(e) => update('needType', e.target.value)}
          style={{ cursor: 'pointer', width: '100%', marginTop: '0.3rem' }}
        >
          <option value="all">All</option>
          <option value="medical">Medical</option>
          <option value="accidental">Accidental</option>
          <option value="food">Food</option>
          <option value="shelter">Shelter</option>
          <option value="rescue">Rescue</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* District */}
      <div>
        <label className="dashboard-filter-label" htmlFor="district-filter">District</label>
        <select
          id="district-filter"
          className="input-field"
          value={filters.district}
          onChange={(e) => update('district', e.target.value)}
          style={{ cursor: 'pointer', width: '100%', marginTop: '0.3rem' }}
        >
          {districts.map((district) => (
            <option key={district} value={district}>
              {district === 'all' ? 'All Districts' : district}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={() => {
            setFilters({ status: 'all', needType: 'all', district: 'all' });
            setSort('urgency_score');
          }}
          style={{
            marginTop: '0.15rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid rgba(195, 93, 81, 0.2)',
            background: 'rgba(195, 93, 81, 0.04)',
            color: '#c35d51',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            transition: 'all 200ms',
          }}
        >
          <X size={12} />
          Clear All Filters
        </button>
      )}
    </section>
  );
};

export default DashboardFilters;
