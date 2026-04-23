import MainLayout from '../layouts/MainLayout';
import { useCoordinatorDashboard } from '../hooks/useCoordinatorDashboard';
import DashboardSummaryCards from '../components/dashboard/DashboardSummaryCards';
import DashboardFilters from '../components/dashboard/DashboardFilters';
import NeedsHeatmap from '../components/dashboard/NeedsHeatmap';
import NeedsList from '../components/dashboard/NeedsList';
import MatchModal from '../components/dashboard/MatchModal';
import KanbanBoard from '../components/dashboard/KanbanBoard';
import DashboardToast from '../components/dashboard/DashboardToast';

const DashboardPage = () => {
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
    toast,
  } = useCoordinatorDashboard();

  return (
    <MainLayout>
      <div className="dashboard-shell container-lg">
        <section className="dashboard-hero">
          <p className="landing-eyebrow">Coordinator Command Center</p>
          <h1 className="dashboard-title">Real-time aid orchestration from report to resolution.</h1>
          <p className="dashboard-subtitle">
            Filter needs, inspect urgency heatmap, dispatch ranked volunteers, and move work through the task pipeline.
          </p>
        </section>

        {loading ? (
          <div className="dashboard-card">
            <p className="text-sm text-text-secondary">Loading dashboard data...</p>
          </div>
        ) : null}

        {error ? (
          <div className="dashboard-card">
            <p className="text-sm text-accent-rose">{error}</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <DashboardSummaryCards summary={summary} />

            <section className="dashboard-layout">
              <aside className="dashboard-sidebar">
                <DashboardFilters filters={filters} setFilters={setFilters} districts={districts} />
              </aside>

              <div className="dashboard-main-stack">
                <NeedsHeatmap
                  needs={sortedNeeds}
                  selectedNeedId={selectedNeedId}
                  setSelectedNeedId={setSelectedNeedId}
                  onDispatch={openDispatchModal}
                />

                <NeedsList
                  needs={sortedNeeds}
                  selectedNeedId={selectedNeedId}
                  setSelectedNeedId={setSelectedNeedId}
                  sorting={sorting}
                  setSort={setSort}
                  onDispatch={openDispatchModal}
                />
              </div>
            </section>

            <KanbanBoard
              needs={sortedNeeds}
              tasks={tasks}
              onDispatch={openDispatchModal}
              onUpdateTask={updatePipelineStatus}
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
      </div>
    </MainLayout>
  );
};

export default DashboardPage;
