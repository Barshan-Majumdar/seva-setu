const DashboardFilters = ({ filters, setFilters, districts, sorting, setSort }) => {
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <section className="dashboard-sidebar-card">
      <h2 className="dashboard-card-title" style={{ marginBottom: '0.25rem' }}>Filters & Sort</h2>

      {/* Sort By */}
      <div>
        <label className="dashboard-filter-label" htmlFor="sort-filter">Sort By</label>
        <select
          id="sort-filter"
          className="input-field"
          value={sorting?.key || 'urgency_score'}
          onChange={(e) => setSort(e.target.value)}
          style={{ cursor: 'pointer', width: '100%', marginTop: '0.35rem' }}
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
          style={{ cursor: 'pointer', width: '100%', marginTop: '0.35rem' }}
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
          style={{ cursor: 'pointer', width: '100%', marginTop: '0.35rem' }}
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
          style={{ cursor: 'pointer', width: '100%', marginTop: '0.35rem' }}
        >
          {districts.map((district) => (
            <option key={district} value={district}>
              {district === 'all' ? 'All Districts' : district}
            </option>
          ))}
        </select>
      </div>

      {/* Active filter indicator */}
      {(filters.status !== 'all' || filters.needType !== 'all' || filters.district !== 'all' || (sorting?.key && sorting.key !== 'urgency_score')) && (
        <button
          onClick={() => {
            setFilters({ status: 'all', needType: 'all', district: 'all' });
            setSort('urgency_score');
          }}
          style={{
            marginTop: '0.25rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(244,63,94,0.3)',
            background: 'rgba(244,63,94,0.05)',
            color: '#f43f5e',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
          }}
        >
          ✕ Clear All Filters
        </button>
      )}
    </section>
  );
};

export default DashboardFilters;
