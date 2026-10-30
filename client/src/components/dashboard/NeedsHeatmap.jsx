import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { formatElapsed, disasterColor } from '../../utils/dashboard';
import 'leaflet/dist/leaflet.css';

const RecenterMap = ({ center, selectedNeed }) => {
  const map = useMap();
  const hasSetInitialViewRef = useRef(false);
  const lastSelectedIdRef = useRef(null);
  
  useEffect(() => {
    if (map) {
      // Invalidate size on mount and after short tick to guarantee tiles fill the container
      map.invalidateSize();
      const t = setTimeout(() => {
        try { map.invalidateSize(); } catch (_) {}
      }, 250);
      return () => clearTimeout(t);
    }
  }, [map]);

  useEffect(() => {
    // 1. Initial Load: Center on the data cluster
    if (!hasSetInitialViewRef.current && center && Array.isArray(center) && !Number.isNaN(Number(center[0])) && !Number.isNaN(Number(center[1]))) {
      map.setView(center, 11);
      hasSetInitialViewRef.current = true;
    }
  }, [center, map]);

  useEffect(() => {
    // 2. Selection Change: Smoothly fly to the selected need ONLY if the ID actually changed
    if (selectedNeed && selectedNeed.id !== lastSelectedIdRef.current) {
      const lat = Number(selectedNeed.lat);
      const lng = Number(selectedNeed.lng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0) {
        map.flyTo([lat, lng], 14, { duration: 1.5 });
        lastSelectedIdRef.current = selectedNeed.id;
      }
    } else if (!selectedNeed) {
      lastSelectedIdRef.current = null;
    }
  }, [selectedNeed, map]);

  return null;
};

const deriveCenter = (needs = []) => {
  const safeNeeds = Array.isArray(needs) ? needs : [];
  const openNeeds = safeNeeds.filter((need) => need && need.status === 'open' && need.district);
  const candidates = openNeeds.length > 0 ? openNeeds : safeNeeds;
  if (candidates.length === 0) return [22.5726, 88.3639];

  const byDistrict = candidates.reduce((acc, need) => {
    if (!need) return acc;
    const key = need.district || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(need);
    return acc;
  }, {});

  const topDistrictNeeds = Object.values(byDistrict).sort((a, b) => b.length - a.length)[0] || candidates;

  const validNeeds = topDistrictNeeds.filter(n => {
    if (!n) return false;
    const lat = Number(n.lat);
    const lng = Number(n.lng);
    return !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0;
  });
  if (validNeeds.length === 0) return [22.5726, 88.3639];

  const latAvg = validNeeds.reduce((sum, need) => sum + Number(need.lat || 0), 0) / validNeeds.length;
  const lngAvg = validNeeds.reduce((sum, need) => sum + Number(need.lng || 0), 0) / validNeeds.length;
  if (Number.isNaN(latAvg) || Number.isNaN(lngAvg) || latAvg === 0 || lngAvg === 0) {
    return [22.5726, 88.3639];
  }
  return [latAvg, lngAvg];
};

const NeedsHeatmap = ({
  needs = [],
  volunteers = [],
  selectedNeedId,
  setSelectedNeedId,
  onDispatch,
  selectedNeed: propSelectedNeed,
  onSelectNeed
}) => {
  const center = useMemo(() => deriveCenter(needs), [needs]);
  const activeSelectedNeed = useMemo(() => {
    if (propSelectedNeed) return propSelectedNeed;
    return needs.find(n => n.id === selectedNeedId);
  }, [needs, selectedNeedId, propSelectedNeed]);

  const handleSelect = (need) => {
    if (setSelectedNeedId) setSelectedNeedId(need.id);
    if (onSelectNeed) onSelectNeed(need);
  };

  const validNeeds = useMemo(() => {
    return needs
      .filter((n) => n.status !== 'completed' && n.status !== 'archived')
      .map((need) => ({
        ...need,
        lat: Number(need.lat),
        lng: Number(need.lng),
        urgency_score: Number(need.urgency_score || 0),
      }))
      .filter((need) => !Number.isNaN(need.lat) && !Number.isNaN(need.lng) && need.lat !== 0 && need.lng !== 0);
  }, [needs]);

  return (
    <section className="dashboard-card" style={{ marginBottom: '1.5rem' }}>
      <div className="dashboard-card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 className="dashboard-card-title" style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Needs Heatmap</h2>
        <div className="dashboard-map-legend" aria-label="Disaster types" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.75rem' }}>
          <span><i style={{ background: '#f43f5e' }} /> Medical</span>
          <span><i style={{ background: '#0ea5e9' }} /> Food</span>
          <span><i style={{ background: '#f59e0b' }} /> Shelter</span>
          <span><i style={{ background: '#8b5cf6' }} /> Education</span>
          <span><i style={{ background: '#64748b' }} /> Other</span>
          <span><i style={{ background: '#3b82f6' }} /> Volunteer</span>
        </div>
      </div>

      <div style={{ width: '100%', height: 'clamp(280px, 42vh, 420px)', minHeight: '260px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0, 0, 0, 0.08)' }}>
        <MapContainer
          className="dashboard-map"
          center={center}
          zoom={11}
          scrollWheelZoom
          style={{ width: '100%', height: '100%' }}
        >
          <RecenterMap center={center} selectedNeed={activeSelectedNeed} />
          
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Volunteer Markers */}
          {volunteers.map((vol) => {
            const vLat = Number(vol.lat);
            const vLng = Number(vol.lng);
            if (Number.isNaN(vLat) || Number.isNaN(vLng) || vLat === 0) return null;
            return (
              <CircleMarker
                key={vol.user_id || vol.id}
                center={[vLat, vLng]}
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
                  <div className="space-y-1 min-w-40" style={{ padding: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                        VOLUNTEER
                      </span>
                      <p style={{ fontWeight: 600, fontSize: '13px', margin: 0 }}>{vol.name}</p>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>Phone: {vol.phone || 'N/A'}</p>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>Status: {vol.is_available ? 'Available' : 'Busy'}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* Need Markers */}
          {validNeeds.map((need) => {
            const isSelected = activeSelectedNeed?.id === need.id;
            const typeColor = need.is_disaster_zone ? '#ef4444' : disasterColor(need.need_type);
            const urgencyVal = Number(need.urgency_score) || 0;
            const markerRadius = isSelected ? 14 : Math.max(8, Math.min(18, urgencyVal * 1.5));

            return (
              <CircleMarker
                key={need.id}
                center={[need.lat, need.lng]}
                radius={markerRadius}
                pathOptions={{
                  color: need.is_verified ? '#fff' : typeColor,
                  fillColor: typeColor,
                  fillOpacity: isSelected ? 0.95 : 0.7,
                  weight: need.is_verified ? 3 : 1.5,
                  className: `pulse-marker ${need.is_verified ? 'verified-pulse' : ''}`,
                }}
                style={{ '--marker-color': typeColor }}
                eventHandlers={{
                  click: () => handleSelect(need),
                }}
              >
                <Popup>
                  <div className="space-y-2 min-w-48" style={{ padding: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      {need.is_verified && (
                        <span style={{ background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                          VERIFIED
                        </span>
                      )}
                      <p style={{ fontWeight: 700, fontSize: '14px', margin: 0, color: '#0f172a' }}>{need.title}</p>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748b', display: 'grid', gap: '3px' }}>
                      <p style={{ margin: 0 }}><strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{typeof need.need_type === 'string' ? need.need_type : 'Other'}</span></p>
                      <p style={{ margin: 0 }}><strong>Location:</strong> {need.ward || 'Ward -'}, {need.district || 'Kolkata'}</p>
                      <p style={{ margin: 0 }}><strong>Urgency Score:</strong> <span style={{ color: typeColor, fontWeight: 700 }}>{urgencyVal.toFixed(1)}</span></p>
                      <p style={{ margin: 0 }}><strong>People Affected:</strong> {need.people_affected || 0}</p>
                      <p style={{ margin: 0 }}><strong>Status:</strong> <span style={{ textTransform: 'capitalize' }}>{need.status}</span></p>
                      <p style={{ margin: 0 }}><strong>Reported:</strong> {formatElapsed(need.created_at)}</p>
                    </div>

                    {need.is_disaster_zone && (
                      <div style={{ margin: '6px 0', padding: '4px 8px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#b91c1c' }}>
                        High Impact Disaster Zone
                      </div>
                    )}

                    {need.description && (
                      <p style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic', margin: '6px 0', borderLeft: '2px solid #cbd5e1', paddingLeft: '6px' }}>
                        "{need.description}"
                      </p>
                    )}

                    {onDispatch && (
                      <button
                        type="button"
                        className="dashboard-dispatch-btn"
                        onClick={() => onDispatch(need)}
                        disabled={need.status !== 'open'}
                        style={{ marginTop: '0.5rem', width: '100%', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                      >
                        Dispatch
                      </button>
                    )}
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

export default NeedsHeatmap;
