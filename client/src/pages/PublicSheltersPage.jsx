import { useState, useMemo } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useShelterManager } from '../hooks/useShelterManager';
import ShelterMap from '../components/dashboard/shelters/ShelterMap';
import ShelterList from '../components/dashboard/shelters/ShelterList';
import ShelterFilters from '../components/dashboard/shelters/ShelterFilters';
import ShelterDetailPanel from '../components/dashboard/shelters/ShelterDetailPanel';

const PublicSheltersPage = () => {
  const shelterManager = useShelterManager();
  const allShelters = shelterManager.getAllShelters();
  
  const [selectedShelterId, setSelectedShelterId] = useState(null);
  
  // Filters State
  const [filters, setFilters] = useState({
    state: 'All',
    district: 'All',
    shelterId: 'All',
    status: 'open', // Default to showing open shelters for public users
    minCapacity: ''
  });

  // Apply filters
  const filteredShelters = useMemo(() => {
    return allShelters.filter(s => {
      // Exclude archived/internal only shelters if any logic applies. We show open/full/closing.
      if (s.status === 'archived') return false;
      
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
  const [viewMode, setViewMode] = useState('map'); // Default to map for public

  return (
    <MainLayout>
      <div className="dashboard-shell container-lg" style={{ zoom: 0.85 }}>
        {/* Hero Section */}
        <section className="dashboard-hero-premium">
          <div className="dashboard-hero-top">
            <div className="dashboard-hero-text">
              <p style={{ color: '#2d6148', letterSpacing: '0.1em', fontWeight: 700, fontSize: '0.7rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Shelter Directory
              </p>
              <h1 className="dashboard-title-premium">
                Find nearby safe zones and shelters.
              </h1>
              <p className="dashboard-subtitle-premium">
                Locate active shelters, check live capacity, and get directions for yourself or others in need.
              </p>
            </div>
          </div>
        </section>

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
                isCoordinator={false} /* VERY IMPORTANT: Read-only mode */
              />
            </aside>
          )}
          
        </section>
      </div>
    </MainLayout>
  );
};

export default PublicSheltersPage;
