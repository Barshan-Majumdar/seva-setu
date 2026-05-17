import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { formatElapsed, urgencyColor, disasterColor } from '../../utils/dashboard';
import 'leaflet/dist/leaflet.css';

const RecenterMap = ({ center, selectedNeed, needs }) => {
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
    // 2. Selection Change: Smoothly fly to the selected need ONLY if the ID actually changed
    if (selectedNeed && selectedNeed.id !== lastSelectedIdRef.current) {
      map.flyTo([Number(selectedNeed.lat), Number(selectedNeed.lng)], 14, {
        duration: 1.5
      });
      lastSelectedIdRef.current = selectedNeed.id;
    } else if (!selectedNeed) {
      lastSelectedIdRef.current = null;
    }
  }, [selectedNeed, map]);

  return null;
};

const deriveCenter = (needs) => {
  const openNeeds = needs.filter((need) => need.status === 'open' && need.district);
  const candidates = openNeeds.length > 0 ? openNeeds : needs;
  if (candidates.length === 0) return [22.5726, 88.3639];

  const byDistrict = candidates.reduce((acc, need) => {
    const key = need.district || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(need);
    return acc;
  }, {});

  const topDistrictNeeds = Object.values(byDistrict).sort((a, b) => b.length - a.length)[0] || candidates;

  const latAvg = topDistrictNeeds.reduce((sum, need) => sum + Number(need.lat || 0), 0) / topDistrictNeeds.length;
  const lngAvg = topDistrictNeeds.reduce((sum, need) => sum + Number(need.lng || 0), 0) / topDistrictNeeds.length;
  return [latAvg, lngAvg];
};

const NeedsHeatmap = ({ needs, volunteers = [], selectedNeedId, setSelectedNeedId, onDispatch }) => {
  const center = useMemo(() => deriveCenter(needs), [needs]);
  const selectedNeed = useMemo(() => needs.find(n => n.id === selectedNeedId), [needs, selectedNeedId]);

  return (
    <section className="dashboard-card">
      <div className="dashboard-card-header">
        <h2 className="dashboard-card-title">Needs Heatmap</h2>
        <div className="dashboard-map-legend" aria-label="Disaster types">
          <span><i style={{ background: '#f43f5e' }} /> Medical</span>
          <span><i style={{ background: '#0ea5e9' }} /> Food</span>
          <span><i style={{ background: '#f59e0b' }} /> Shelter</span>
          <span><i style={{ background: '#8b5cf6' }} /> Education</span>
          <span><i style={{ background: '#64748b' }} /> Other</span>
          <span><i style={{ background: '#3b82f6' }} /> Volunteer</span>
        </div>
      </div>

      <MapContainer className="dashboard-map" center={center} zoom={11} scrollWheelZoom>
        <RecenterMap center={center} selectedNeed={selectedNeed} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {volunteers.map((vol) => {
          if (!vol.lat || !vol.lng) return null;
          return (
            <CircleMarker
              key={vol.user_id}
              center={[Number(vol.lat), Number(vol.lng)]}
              radius={8}
              pathOptions={{
                color: '#fff',
                fillColor: '#3b82f6',
                fillOpacity: 0.9,
                weight: 2,
                className: 'volunteer-pulse-marker',
              }}
            >
              <Popup>
                <div className="space-y-1 min-w-40">
                  <div className="flex items-center gap-2">
                    <span style={{ background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                      VOLUNTEER
                    </span>
                    <p className="font-semibold text-sm">{vol.name}</p>
                  </div>
                  <p className="text-xs text-slate-600">Phone: {vol.phone || 'N/A'}</p>
                  <p className="text-xs text-slate-600">Status: {vol.is_available ? 'Available' : 'Busy'}</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {needs
          .filter((n) => n.status !== 'completed' && n.status !== 'archived')
          .map((need) => {
          const isSelected = selectedNeedId === need.id;
          const typeColor = disasterColor(need.need_type);

          return (
            <CircleMarker
              key={need.id}
              center={[Number(need.lat), Number(need.lng)]}
              radius={isSelected ? 14 : 10}
              pathOptions={{
                color: need.is_verified ? '#fff' : typeColor, // White border for verified
                fillColor: typeColor,
                fillOpacity: isSelected ? 0.9 : 0.7,
                weight: need.is_verified ? 3 : 1,
                className: `pulse-marker ${need.is_verified ? 'verified-pulse' : ''}`,
              }}
              style={{ '--marker-color': typeColor }}
              eventHandlers={{ click: () => setSelectedNeedId(need.id) }}
            >
              <Popup>
                <div className="space-y-2 min-w-48">
                  <div className="flex items-center gap-2">
                    {need.is_verified && (
                      <span 
                        style={{ background: '#34d399', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}
                      >
                        VERIFIED
                      </span>
                    )}
                    <p className="font-semibold text-sm">{need.title}</p>
                  </div>
                  <p className="text-xs text-slate-600">Urgency: {need.urgency_score}</p>
                  <p className="text-xs text-slate-600">People affected: {need.people_affected || 0}</p>
                  <p className="text-xs text-slate-600">Status: {need.status}</p>
                  <p className="text-xs text-slate-600">Reported: {formatElapsed(need.created_at)}</p>
                  {need.description && (
                    <p className="text-xs text-slate-500 italic mt-2 border-l-2 border-slate-200 pl-2">
                      "{need.description}"
                    </p>
                  )}
                  <button
                    type="button"
                    className="dashboard-dispatch-btn"
                    onClick={() => onDispatch(need)}
                    disabled={need.status !== 'open'}
                    style={{ marginTop: '0.5rem', width: '100%' }}
                  >
                    Dispatch
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </section>
  );
};

export default NeedsHeatmap;
