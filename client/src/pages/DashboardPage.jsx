import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Plus, UserCheck } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { useCoordinatorDashboard } from '../hooks/useCoordinatorDashboard';
import DashboardSummaryCards from '../components/dashboard/DashboardSummaryCards';
import DashboardFilters from '../components/dashboard/DashboardFilters';
import NeedsHeatmap from '../components/dashboard/NeedsHeatmap';
import NeedsList from '../components/dashboard/NeedsList';
import MatchModal from '../components/dashboard/MatchModal';
import KanbanBoard from '../components/dashboard/KanbanBoard';
import DashboardToast from '../components/dashboard/DashboardToast';
import CoordinatorManagerModal from '../components/dashboard/CoordinatorManagerModal';

const DashboardPage = () => {
  const [showManager, setShowManager] = useState(false);
  const {
    loading,
    error,
    summary,
    filters,
    setFilters,
    districts,
    sortedNeeds,
    selectedNeedId,
    setSelectedNeedId,
    sorting,
    setSort,
    tasks,
    matchModalNeed,
    matches,
    matchesLoading,
    assigningVolunteerId,
    openDispatchModal,
    closeDispatchModal,
    assignVolunteer,
    updatePipelineStatus,
    deleteNeed, // THIS IS THE FUNCTION
    toast,
    pendingVolunteerRequests,
  } = useCoordinatorDashboard();

  console.log("DEBUG DASHBOARD: deleteNeed type is", typeof deleteNeed);

  return (
    <MainLayout>
      <div className="dashboard-shell container-lg">
        <section className="dashboard-hero" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link 
              to="/field"
              className="dashboard-dispatch-btn" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface-secondary)' }}
            >
              <Plus size={14} />
              Report New Need
            </Link>
            <Link
              to="/volunteer-approvals"
              className="dashboard-dispatch-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface-secondary)', position: 'relative' }}
            >
              <UserCheck size={14} />
              Requests
              {pendingVolunteerRequests > 0 && (
                <span style={{
                  position: 'absolute', top: '-6px', right: '-6px',
                  background: '#fb7185', color: '#fff',
                  fontSize: '0.6rem', fontWeight: 900,
                  width: '18px', height: '18px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(251, 113, 133, 0.4)',
                }}>
                  {pendingVolunteerRequests}
                </span>
              )}
            </Link>
            <button 
              onClick={() => setShowManager(true)}
              className="dashboard-dispatch-btn" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface-secondary)' }}
            >
              <Settings size={14} />
              Manage Coordinators
            </button>
          </div>
          <p className="landing-eyebrow">Coordinator Command Center</p>
          <h1 className="dashboard-title">Real-time aid orchestration from report to resolution.</h1>
          <p className="dashboard-subtitle">
            Filter needs, inspect urgency heatmap, dispatch ranked volunteers, and move work through the task pipeline.
          </p>
        </section>

        {loading ? (
          <div className="dashboard-card">
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Loading dashboard data...</p>
          </div>
        ) : null}

        {error ? (
          <div className="dashboard-card">
            <p style={{ fontSize: '0.875rem', color: '#fb7185' }}>{error}</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <DashboardSummaryCards summary={summary} />

            <section className="dashboard-layout">
              <aside className="dashboard-sidebar">
                <DashboardFilters 
                  filters={filters} 
                  setFilters={setFilters} 
                  districts={districts} 
                  sorting={sorting}
                  setSort={setSort}
                />
              </aside>

              <div className="dashboard-main-stack">
                <NeedsHeatmap
                  needs={sortedNeeds}
                  selectedNeedId={selectedNeedId}
                  setSelectedNeedId={setSelectedNeedId}
                  onDispatch={openDispatchModal}
                />

                <NeedsList
                  needs={sortedNeeds.slice(0, 6)}
                  selectedNeedId={selectedNeedId}
                  setSelectedNeedId={setSelectedNeedId}
                  sorting={sorting}
                  setSort={setSort}
                  onDispatch={openDispatchModal}
                  onDelete={deleteNeed} 
                />

                {sortedNeeds.length > 6 && (
                  <div className="text-center mt-4">
                    <Link to="/needs-archive" className="btn-ghost" style={{ fontSize: '0.8rem' }}>
                      View All Issues ({sortedNeeds.length - 6} more)
                    </Link>
                  </div>
                )}
              </div>
            </section>

            <KanbanBoard
              needs={sortedNeeds}
              tasks={tasks}
              onDispatch={openDispatchModal}
              onUpdateTask={updatePipelineStatus}
              onDelete={deleteNeed}
            />
          </>
        ) : null}

        <MatchModal
          need={matchModalNeed}
          matches={matches}
          loading={matchesLoading}
          assigningVolunteerId={assigningVolunteerId}
          onClose={closeDispatchModal}
          onAssign={assignVolunteer}
        />

        <DashboardToast toast={toast} />

        {showManager && <CoordinatorManagerModal onClose={() => setShowManager(false)} />}
      </div>
    </MainLayout>
  );
};

export default DashboardPage;
