import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { formatElapsed, urgencyColor } from '../../utils/dashboard';

const RecenterMap = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 11, { animate: true });
  }, [center, map]);
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

const NeedsHeatmap = ({ needs, selectedNeedId, setSelectedNeedId, onDispatch }) => {
  const center = useMemo(() => deriveCenter(needs), [needs]);

  return (
    <section className="dashboard-card">
      <div className="dashboard-card-header">
        <h2 className="dashboard-card-title">Needs Heatmap</h2>
        <div className="dashboard-map-legend" aria-label="Urgency legend">
          <span><i style={{ background: '#fb7185' }} /> 8-10</span>
          <span><i style={{ background: '#f59e0b' }} /> 5-7</span>
          <span><i style={{ background: '#34d399' }} /> 1-4</span>
        </div>
      </div>

      <MapContainer className="dashboard-map" center={center} zoom={11} scrollWheelZoom>
        <RecenterMap center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {needs.map((need) => {
          const isSelected = selectedNeedId === need.id;
          const color = urgencyColor(need.urgency_score);

          return (
            <CircleMarker
              key={need.id}
              center={[Number(need.lat), Number(need.lng)]}
              radius={isSelected ? 12 : 9}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: isSelected ? 0.8 : 0.55,
                weight: isSelected ? 3 : 1,
              }}
              eventHandlers={{ click: () => setSelectedNeedId(need.id) }}
            >
              <Popup>
                <div className="space-y-2 min-w-48">
                  <p className="font-semibold text-sm">{need.title}</p>
                  <p className="text-xs text-slate-600">Urgency: {need.urgency_score}</p>
                  <p className="text-xs text-slate-600">People affected: {need.people_affected || 0}</p>
                  <p className="text-xs text-slate-600">Status: {need.status}</p>
                  <p className="text-xs text-slate-600">Reported: {formatElapsed(need.created_at)}</p>
                  <button
                    type="button"
                    className="dashboard-dispatch-btn"
                    onClick={() => onDispatch(need)}
                    disabled={need.status !== 'open'}
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
