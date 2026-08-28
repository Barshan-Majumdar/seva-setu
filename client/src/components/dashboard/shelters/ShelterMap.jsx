import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const FilterFlyTo = ({ filters }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!filters) return;
    
    let query = '';
    if (filters.district && filters.district !== 'All') {
      query = `${filters.district}, ${filters.state}, India`;
    } else if (filters.state && filters.state !== 'All') {
      query = `${filters.state}, India`;
    }

    if (query) {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.length > 0) {
            const bbox = data[0].boundingbox;
            // Nominatim bbox is [latMin, latMax, lonMin, lonMax] string array
            map.flyToBounds([
              [Number(bbox[0]), Number(bbox[2])],
              [Number(bbox[1]), Number(bbox[3])]
            ], { padding: [20, 20], duration: 1.5 });
          }
        })
        .catch(err => console.error("Geocoding failed", err));
    }
  }, [filters, map]);

  return null;
};

const RecenterMap = ({ center, selectedShelterId, shelters }) => {
  const map = useMap();
  
  useEffect(() => {
    // 1. Initial Load: Center on the data cluster
    if (!map._hasSetInitialView && center) {
      map.setView(center, 11);
      map._hasSetInitialView = true;
    }
  }, [center, map]);

  const lastSelectedIdRef = useRef(null);

  useEffect(() => {
    // 2. Selection Change: Smoothly fly to the selected shelter
    const selectedShelter = shelters.find(s => s.id === selectedShelterId);
    if (selectedShelter && selectedShelter.id !== lastSelectedIdRef.current) {
      map.flyTo([Number(selectedShelter.lat), Number(selectedShelter.lng)], 14, {
        duration: 1.5
      });
      lastSelectedIdRef.current = selectedShelter.id;
    } else if (!selectedShelter) {
      lastSelectedIdRef.current = null;
    }
  }, [selectedShelterId, map, shelters]);

  return null;
};

const deriveCenter = (shelters) => {
  if (shelters.length === 0) return [28.6139, 77.2090]; // Default to Delhi

  const latAvg = shelters.reduce((sum, s) => sum + Number(s.lat || 0), 0) / shelters.length;
  const lngAvg = shelters.reduce((sum, s) => sum + Number(s.lng || 0), 0) / shelters.length;
  return [latAvg, lngAvg];
};

const getPinColor = (occupancyPercent, isClosed) => {
  if (isClosed) return '#94a3b8'; // Slate for closed
  if (occupancyPercent >= 100) return '#dc2626'; // Red
  if (occupancyPercent >= 70) return '#d97706'; // Amber
  return '#059669'; // Green
};

const ShelterMap = ({ shelters, filters, selectedShelterId, setSelectedShelterId }) => {
  const center = useMemo(() => deriveCenter(shelters), [shelters]);

  return (
    <section className="dashboard-card" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
      <div className="dashboard-card-header" style={{ flexShrink: 0 }}>
        <h2 className="dashboard-card-title">Shelter Map</h2>
        <div className="dashboard-map-legend" aria-label="Occupancy levels">
          <span><i style={{ background: '#059669' }} /> <span style={{fontSize: '0.75rem', fontWeight: 600}}>0-69% Full</span></span>
          <span><i style={{ background: '#d97706' }} /> <span style={{fontSize: '0.75rem', fontWeight: 600}}>70-99% Full</span></span>
          <span><i style={{ background: '#dc2626' }} /> <span style={{fontSize: '0.75rem', fontWeight: 600}}>Overcrowded</span></span>
          <span><i style={{ background: '#94a3b8' }} /> <span style={{fontSize: '0.75rem', fontWeight: 600}}>Closed</span></span>
        </div>
      </div>

      <div style={{ flex: 1, borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
        <MapContainer style={{ height: '100%', width: '100%' }} center={center} zoom={11} scrollWheelZoom>
          <FilterFlyTo filters={filters} />
          <RecenterMap center={center} selectedShelterId={selectedShelterId} shelters={shelters} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {shelters.map((shelter) => {
            const isSelected = selectedShelterId === shelter.id;
            const isClosed = shelter.status === 'closed' || shelter.status === 'archived';
            const typeColor = getPinColor(shelter.occupancyPercent, isClosed);

            return (
              <CircleMarker
                key={shelter.id}
                center={[Number(shelter.lat), Number(shelter.lng)]}
                radius={isSelected ? 14 : 10}
                pathOptions={{
                  color: '#fff',
                  fillColor: typeColor,
                  fillOpacity: isSelected ? 0.9 : 0.75,
                  weight: 2,
                  className: `pulse-marker ${isSelected ? 'verified-pulse' : ''}`,
                }}
                eventHandlers={{ click: () => setSelectedShelterId(shelter.id) }}
              >
                <Popup>
                  <div className="space-y-2 min-w-48">
                    <p className="font-semibold text-sm" style={{ marginBottom: '0.25rem' }}>{shelter.name}</p>
                    <p className="text-xs text-slate-600"><strong>Capacity:</strong> {shelter.occupancyCurrent} / {shelter.capacityTotal}</p>
                    <p className="text-xs text-slate-600"><strong>Occupancy:</strong> {shelter.occupancyPercent}%</p>
                    <p className="text-xs text-slate-600"><strong>Status:</strong> <span style={{ textTransform: 'capitalize' }}>{shelter.status}</span></p>
                    {shelter.hasCriticalResource && (
                      <p className="text-xs" style={{ color: '#dc2626', fontWeight: 700, marginTop: '0.25rem' }}>
                        ⚠️ Low Stock Alert
                      </p>
                    )}
                    {shelter.openIncidentsCount > 0 && (
                      <p className="text-xs" style={{ color: '#d97706', fontWeight: 700 }}>
                        ⚠️ {shelter.openIncidentsCount} Open Incident(s)
                      </p>
                    )}
                    <button
                      type="button"
                      className="dashboard-dispatch-btn"
                      onClick={() => setSelectedShelterId(shelter.id)}
                      style={{ marginTop: '0.75rem', width: '100%', padding: '0.3rem', fontSize: '0.75rem' }}
                    >
                      View Details
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </section>
  );
};

export default ShelterMap;
