import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Plus, UserCheck, Mic } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { useCoordinatorDashboard } from '../hooks/useCoordinatorDashboard';
import { useFieldForm } from '../hooks/useFieldForm';
import VoiceVideoAssistantModal from '../components/voice/VoiceVideoAssistantModal';
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
    volunteers,
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

  const [showVoiceAssistantModal, setShowVoiceAssistantModal] = useState(false);
  const {
    formData,
    loading: formLoading,
    locLoading,
    success: formSuccess,
    successMessage: formSuccessMessage,
    error: formError,
    verificationResult,
    isOnline,
    updateField,
    updateMultipleFields,
    resetForm,
    getLocation,
    submitForm,
  } = useFieldForm();

  useEffect(() => {
    const handleVoiceTrigger = () => {
      setShowVoiceAssistantModal(true);
    };
    window.addEventListener('sevasetu:activate-voice-form', handleVoiceTrigger);
    return () => window.removeEventListener('sevasetu:activate-voice-form', handleVoiceTrigger);
  }, []);

  const handleApplyVoiceData = (fields, photoFile, loc) => {
    if (fields && Object.keys(fields).length > 0) {
      updateMultipleFields(fields);
    }
    if (photoFile) {
      updateField('imageFile', photoFile);
    }
    if (loc && loc.lat && loc.lng) {
      updateField('lat', parseFloat(loc.lat));
      updateField('lng', parseFloat(loc.lng));
    } else if (!formData.lat) {
      getLocation();
    }
  };

  console.log("DEBUG DASHBOARD: deleteNeed type is", typeof deleteNeed);
  console.log("DEBUG API: Connecting to", import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api');

  return (
    <MainLayout>
      <div className="dashboard-shell container-lg">
        <section className="dashboard-hero-premium">
          <div className="dashboard-hero-top">
            <div className="dashboard-hero-text">
              <p style={{ color: '#2d6148', letterSpacing: '0.1em', fontWeight: 700, fontSize: '0.7rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Coordinator Command Center</p>
              <h1 className="dashboard-title-premium">Real-time aid orchestration from report to resolution.</h1>
              <p className="dashboard-subtitle-premium">
                Filter needs, inspect urgency heatmap, dispatch ranked volunteers, and move work through the task pipeline.
              </p>
            </div>
            <div className="dashboard-hero-actions">
              <button 
                type="button"
                onClick={() => setShowVoiceAssistantModal(true)}
                className="dashboard-dispatch-btn-premium" 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: '#059669',
                  borderColor: 'rgba(5, 150, 105, 0.3)',
                  background: 'rgba(5, 150, 105, 0.06)',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                <Mic size={14} />
                Voice Assistant
              </button>
              <Link 
                to="/field"
                className="dashboard-dispatch-btn-premium primary" 
              >
                <Plus size={14} />
                Report New Need
              </Link>
              <Link
                to="/volunteer-approvals"
                className="dashboard-dispatch-btn-premium"
                style={{ position: 'relative' }}
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
                className="dashboard-dispatch-btn-premium" 
              >
                <Settings size={14} />
                Manage Coordinators
              </button>
            </div>
          </div>
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

            <section className="dashboard-layout" style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
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
                  volunteers={volunteers}
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

      <VoiceVideoAssistantModal
        isOpen={showVoiceAssistantModal}
        onClose={() => {
          setShowVoiceAssistantModal(false);
          resetForm();
        }}
        onApplyData={handleApplyVoiceData}
        onSubmitForm={submitForm}
        formData={formData}
        isOnline={isOnline}
        isSubmitting={formLoading}
        submitSuccess={formSuccess}
        submitError={formError}
      />
    </MainLayout>
  );
};

export default DashboardPage;
