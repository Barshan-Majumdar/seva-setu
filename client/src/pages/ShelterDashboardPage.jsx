import { useState, useMemo } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useShelterManager } from '../hooks/useShelterManager';
import ShelterSummaryStrip from '../components/dashboard/shelters/ShelterSummaryStrip';
import ShelterMap from '../components/dashboard/shelters/ShelterMap';
import ShelterList from '../components/dashboard/shelters/ShelterList';
import ShelterFilters from '../components/dashboard/shelters/ShelterFilters';
import ShelterDetailPanel from '../components/dashboard/shelters/ShelterDetailPanel';
import AddShelterModal from '../components/dashboard/shelters/forms/AddShelterModal';

const ShelterDashboardPage = () => {
  const shelterManager = useShelterManager();
  const allShelters = shelterManager.getAllShelters();
  
  const [selectedShelterId, setSelectedShelterId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filters State
  const [filters, setFilters] = useState({
    state: 'All',
    district: 'All',
    shelterId: 'All',
    status: 'All',
    minCapacity: ''
  });

  // Apply filters
  const filteredShelters = useMemo(() => {
    return allShelters.filter(s => {
      if (filters.state !== 'All' && s.state !== filters.state) return false;
      if (filters.district !== 'All' && s.district !== filters.district) return false;
      if (filters.shelterId !== 'All' && s.id !== filters.shelterId) return false;
      if (filters.status !== 'All' && s.status !== filters.status) return false;
      if (filters.minCapacity !== '') {
        const minCap = parseInt(filters.minCapacity, 10);
        if (!isNaN(minCap) && (s.capacityTotal - s.occupancyCurrent) < minCap) return false;
      }
      return true;
    });
  }, [allShelters, filters]);

  // View toggle: Map vs List
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'

  return (
    <MainLayout>
      <div className="dashboard-shell container-lg" style={{ zoom: 0.85 }}>
        {/* Hero Section */}
        <section className="dashboard-hero-premium">
          <div className="dashboard-hero-top">
            <div className="dashboard-hero-text">
              <p style={{ color: '#2d6148', letterSpacing: '0.1em', fontWeight: 700, fontSize: '0.7rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Shelter Command
              </p>
              <h1 className="dashboard-title-premium">
                Real-time shelter capacity and resource logistics.
              </h1>
              <p className="dashboard-subtitle-premium">
                Monitor occupancy, dispatch resources, and coordinate shelter staffing across the disaster zone.
              </p>
            </div>
            <div className="dashboard-hero-actions">
              <button 
                className="dashboard-dispatch-btn-premium primary"
                onClick={() => setShowAddModal(true)}
              >
                + Activate Shelter
              </button>
            </div>
          </div>
        </section>

        {/* Summary Strip */}
        <ShelterSummaryStrip manager={shelterManager} />

        {/* Horizontal Filter Strip */}
        <ShelterFilters 
          filters={filters} 
          setFilters={setFilters} 
          allShelters={allShelters} 
          viewMode={viewMode}
          setViewMode={setViewMode}
          setSelectedShelterId={setSelectedShelterId}
        />

        {/* Main Content Area (Map/List + Detail Panel side-by-side) */}
        <section style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
          
          {/* Left Side: Map or List */}
          <div 
            style={{ 
              flex: selectedShelterId ? '1 1 60%' : '1 1 100%', 
              minWidth: 0,
              transition: 'flex 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
            }}
          >
            {viewMode === 'map' ? (
              <ShelterMap 
                shelters={filteredShelters} 
                filters={filters}
                selectedShelterId={selectedShelterId}
                setSelectedShelterId={setSelectedShelterId}
              />
            ) : (
              <ShelterList 
                shelters={filteredShelters} 
                selectedShelterId={selectedShelterId}
                setSelectedShelterId={setSelectedShelterId}
              />
            )}
          </div>

          {/* Right Side: Detail Panel (conditionally rendered) */}
          {selectedShelterId && (
            <aside style={{ flex: '0 0 450px', minWidth: 0 }}>
              <ShelterDetailPanel 
                shelterId={selectedShelterId} 
                manager={shelterManager}
                onClose={() => setSelectedShelterId(null)}
              />
            </aside>
          )}
          
        </section>

        {showAddModal && (
          <AddShelterModal 
            manager={shelterManager} 
            onClose={() => setShowAddModal(false)} 
          />
        )}
      </div>
    </MainLayout>
  );
};

export default ShelterDashboardPage;
