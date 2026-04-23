const DashboardFilters = ({ filters, setFilters, districts }) => {
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <section className="dashboard-sidebar-card">
      <h2 className="dashboard-card-title">Filters</h2>

      <label className="dashboard-filter-label" htmlFor="status-filter">
        Status
      </label>
      <select
        id="status-filter"
        className="input-field"
        value={filters.status}
        onChange={(e) => update('status', e.target.value)}
      >
        <option value="all">All</option>
        <option value="open">Open</option>
        <option value="assigned">Assigned</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>

      <label className="dashboard-filter-label" htmlFor="type-filter">
        Need Type
      </label>
      <select
        id="type-filter"
        className="input-field"
        value={filters.needType}
        onChange={(e) => update('needType', e.target.value)}
      >
        <option value="all">All</option>
        <option value="medical">Medical</option>
        <option value="food">Food</option>
        <option value="shelter">Shelter</option>
        <option value="education">Education</option>
        <option value="other">Other</option>
      </select>

      <label className="dashboard-filter-label" htmlFor="district-filter">
        District
      </label>
      <select
        id="district-filter"
        className="input-field"
        value={filters.district}
        onChange={(e) => update('district', e.target.value)}
      >
        {districts.map((district) => (
          <option key={district} value={district}>
            {district === 'all' ? 'All districts' : district}
          </option>
        ))}
      </select>
    </section>
  );
};

export default DashboardFilters;
