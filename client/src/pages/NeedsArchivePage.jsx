import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Search, Filter } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { useCoordinatorDashboard } from '../hooks/useCoordinatorDashboard';
import NeedsList from '../components/dashboard/NeedsList';
import DashboardFilters from '../components/dashboard/DashboardFilters';

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
  } = useCoordinatorDashboard();

  return (
    <MainLayout>
      <div className="container-lg py-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <Link to="/dashboard" className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-4">
              <ChevronLeft size={16} />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Full Issues Archive</h1>
            <p className="text-text-secondary mt-2">Comprehensive list of all reported community needs and their statuses.</p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="dashboard-pill dashboard-pill-open">
               {sortedNeeds.length} Total Issues
             </div>
          </div>
        </header>

        <section className="dashboard-layout">
          <aside className="dashboard-sidebar">
            <DashboardFilters filters={filters} setFilters={setFilters} districts={districts} />
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
      </div>
    </MainLayout>
  );
};

export default NeedsArchivePage;
