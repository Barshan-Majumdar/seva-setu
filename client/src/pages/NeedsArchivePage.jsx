import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Search, Filter } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { useCoordinatorDashboard } from '../hooks/useCoordinatorDashboard';
import NeedsList from '../components/dashboard/NeedsList';
import DashboardFilters from '../components/dashboard/DashboardFilters';
import MatchModal from '../components/dashboard/MatchModal';
import DashboardToast from '../components/dashboard/DashboardToast';

const NeedsArchivePage = () => {
  const {
    loading,
    error,
    filters,
    setFilters,
    districts,
    sortedNeeds,
    selectedNeedId,
    setSelectedNeedId,
    sorting,
    setSort,
    openDispatchModal,
    matchModalNeed,
    matches,
    matchesLoading,
    assigningVolunteerId,
    closeDispatchModal,
    assignVolunteer,
    toast,
  } = useCoordinatorDashboard();

  return (
    <MainLayout>
      <div className="container-lg pt-12 pb-8">
        <header className="mb-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text-primary transition-all mb-8 group">
              <ChevronLeft size={16} className="transform group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h1 className="text-3xl sm:text-4xl font-black text-text-primary tracking-tight">Full Issues Archive</h1>
              <div className="flex items-center">
                 <div className="dashboard-pill dashboard-pill-open shadow-sm">
                   {sortedNeeds.length} TOTAL MISSIONS
                 </div>
              </div>
            </div>
            <p className="text-text-secondary mt-3 max-width-prose">
              Comprehensive list of all reported community needs and their real-time operational status.
            </p>
          </div>
        </header>

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

          <main className="dashboard-main-stack">
            {loading ? (
              <div className="dashboard-card p-12 text-center">
                <p className="text-text-muted">Loading complete archive...</p>
              </div>
            ) : error ? (
              <div className="dashboard-card p-12 text-center border-accent-rose">
                <p className="text-accent-rose">{error}</p>
              </div>
            ) : (
              <NeedsList
                needs={sortedNeeds}
                selectedNeedId={selectedNeedId}
                setSelectedNeedId={setSelectedNeedId}
                sorting={sorting}
                setSort={setSort}
                onDispatch={openDispatchModal}
              />
            )}
          </main>
        </section>

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

export default NeedsArchivePage;
