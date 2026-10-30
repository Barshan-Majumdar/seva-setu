import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { formatElapsed, urgencyColor, disasterColor } from '../../utils/dashboard';
import 'leaflet/dist/leaflet.css';

const RecenterMap = ({ center, selectedNeed, needs }) => {
  const map = useMap();
  const hasSetInitialViewRef = useRef(false);
  const lastSelectedIdRef = useRef(null);
  
  useEffect(() => {
    // 1. Initial Load: Center on the data cluster
    if (!hasSetInitialViewRef.current && center) {
      map.setView(center, 11);
      hasSetInitialViewRef.current = true;
    }
  }, [center, map]);

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

const NeedsHeatmap = ({ needs, selectedNeed, onSelectNeed }) => {
  const center = useMemo(() => deriveCenter(needs), [needs]);

  const mapNeeds = useMemo(() => {
    return needs
      .map((need) => ({
        ...need,
        lat: Number(need.lat),
        lng: Number(need.lng),
        urgency_score: Number(need.urgency_score),
      }))
      .filter((need) => !Number.isNaN(need.lat) && !Number.isNaN(need.lng));
  }, [needs]);

  return (
    <div className="dashboard-card map-container">
      <MapContainer center={center} zoom={11} scrollWheelZoom className="leaflet-map-root">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterMap center={center} selectedNeed={selectedNeed} needs={needs} />

        {mapNeeds.map((need) => {
          const isSelected = selectedNeed?.id === need.id;
          const markerColor = need.is_disaster_zone
            ? disasterColor(need.need_type || need.is_disaster_zone)
            : urgencyColor(need.urgency_score);

          return (
            <CircleMarker
              key={need.id}
              center={[need.lat, need.lng]}
              radius={isSelected ? 14 : Math.max(6, need.urgency_score * 1.5)}
              pathOptions={{
                color: isSelected ? '#1e293b' : markerColor,
                fillColor: markerColor,
                fillOpacity: isSelected ? 0.95 : 0.65,
                weight: isSelected ? 3 : 1.5,
              }}
              eventHandlers={{
                click: () => onSelectNeed(need),
              }}
            >
              <Popup>
                <div className="map-popup">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-slate-800 text-sm">{need.title}</span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white"
                      style={{ backgroundColor: markerColor }}
                    >
                      Score: {need.urgency_score.toFixed(1)}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 mb-3">
                    <p className="flex justify-between">
                      <span className="text-slate-400">Ward/District:</span>
                      <span className="font-medium text-slate-700">
                        {need.ward || 'Ward -'}, {need.district || 'Kolkata'}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Type:</span>
                      <span className="font-medium text-slate-700 uppercase">{need.need_type}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Reported:</span>
                      <span className="font-medium text-slate-700">{formatElapsed(need.created_at)}</span>
                    </p>
                  </div>

                  {need.is_disaster_zone && (
                    <div className="mb-2 px-2 py-1 bg-red-50 border border-red-200 rounded text-[11px] font-semibold text-red-700 flex items-center gap-1">
                      <span>⚠️ High Impact Disaster Zone</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectNeed(need)}
                    className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide transition-colors"
                  >
                    View in Triage Board
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default NeedsHeatmap;
