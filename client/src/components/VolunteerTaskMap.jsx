/* VolunteerTaskMap.jsx - FINAL STABLE VERSION */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Maximize2, X, Zap } from 'lucide-react';

const toRad = (deg) => (deg * Math.PI) / 180;

const safeNum = (v) => {
  const n = Number(v);
  return isFinite(n) ? n : null;
};

const haversineKm = (a, b) => {
  if (!a || !b) return 0;
  const lat1 = safeNum(a.lat), lng1 = safeNum(a.lng);
  const lat2 = safeNum(b.lat), lng2 = safeNum(b.lng);
  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) return 0;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const h = Math.sin(dLat/2)**2 + Math.sin(dLon/2)**2 * Math.cos(toRad(lat1)) * Math.cos(toRad(lat2));
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
};

const taskIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41]
});

const RotatingVolunteerMarker = ({ position, heading }) => {
  const lat = safeNum(position?.lat);
  const lng = safeNum(position?.lng);
  if (lat === null || lng === null) return null;

  const icon = useMemo(() => L.divIcon({
    className: 'premium-volunteer-marker',
    html: `<div class="marker-container" style="transform: rotate(${heading || 0}deg);">
             <div class="heading-beam"></div>
             <div class="pulse-ring"></div>
             <div class="marker-core"><div class="marker-blue-center"></div></div>
           </div>`,
    iconSize: [40, 40], iconAnchor: [20, 20]
  }), [heading]);

  return <Marker position={[lat, lng]} icon={icon} />;
};

const MapBoundsHandler = ({ volunteerCoords, taskCoords }) => {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    const tLat = safeNum(taskCoords?.lat);
    const tLng = safeNum(taskCoords?.lng);
    if (tLat === null || tLng === null) return;

    if (!hasCentered.current) {
      const vLat = safeNum(volunteerCoords?.lat);
      const vLng = safeNum(volunteerCoords?.lng);

      if (vLat !== null && vLng !== null) {
        // Both points known — fit bounds
        const bounds = L.latLngBounds([vLat, vLng], [tLat, tLng]);
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        // Only task location known — center on it
        map.setView([tLat, tLng], 14);
      }
      hasCentered.current = true;
    }
  }, [volunteerCoords, taskCoords, map]);

  return null;
};

const VolunteerTaskMap = ({ volunteerCoords, taskCoords }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [routePoints, setRoutePoints] = useState([]);
  const [heading, setHeading] = useState(0);
  const [displayDistance, setDisplayDistance] = useState('--');

  const lastValidPos = useRef(null);
  const smoothedDist = useRef(null);
  const osrmTimeout = useRef(null);

  // Validate task coords — this is the MINIMUM required to show the map
  const tLat = safeNum(taskCoords?.lat);
  const tLng = safeNum(taskCoords?.lng);
  const hasValidTask = tLat !== null && tLng !== null;

  // Validate volunteer coords — optional overlay
  const vLat = safeNum(volunteerCoords?.lat);
  const vLng = safeNum(volunteerCoords?.lng);
  const hasValidVol = vLat !== null && vLng !== null;

  // Map center: use volunteer if available, otherwise center on task
  const mapCenter = hasValidVol ? [vLat, vLng] : [tLat, tLng];

  // 1. DISTANCE SMOOTHING
  useEffect(() => {
    if (!hasValidVol || !hasValidTask) return;
    const raw = haversineKm({ lat: vLat, lng: vLng }, { lat: tLat, lng: tLng });
    if (smoothedDist.current === null) {
      smoothedDist.current = raw;
    } else {
      if (Math.abs(raw - smoothedDist.current) > 100) return;
      smoothedDist.current = smoothedDist.current * 0.8 + raw * 0.2;
    }
    setDisplayDistance(smoothedDist.current.toFixed(2));
  }, [volunteerCoords, taskCoords, hasValidVol, hasValidTask, vLat, vLng, tLat, tLng]);

  // 2. HEADING
  useEffect(() => {
    if (!hasValidVol) return;
    if (volunteerCoords?.heading != null) {
      setHeading(volunteerCoords.heading);
    } else if (lastValidPos.current) {
      const d = haversineKm({ lat: vLat, lng: vLng }, lastValidPos.current);
      if (d > 0.005) {
        const dLng = toRad(vLng - lastValidPos.current.lng);
        const y = Math.sin(dLng) * Math.cos(toRad(vLat));
        const x = Math.cos(toRad(lastValidPos.current.lat)) * Math.sin(toRad(vLat)) -
                  Math.sin(toRad(lastValidPos.current.lat)) * Math.cos(toRad(vLat)) * Math.cos(dLng);
        setHeading(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
      }
    }
    lastValidPos.current = { lat: vLat, lng: vLng };
  }, [volunteerCoords, hasValidVol, vLat, vLng]);

  // 3. ROUTE FETCHING (only if both points are valid)
  const fetchRoute = useCallback(async () => {
    if (!hasValidVol || !hasValidTask) return;
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${vLng},${vLat};${tLng},${tLat}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.code === 'Ok') {
        setRoutePoints(data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]));
      }
    } catch {
      if (hasValidVol) setRoutePoints([[vLat, vLng], [tLat, tLng]]);
    }
  }, [hasValidVol, hasValidTask, vLat, vLng, tLat, tLng]);

  useEffect(() => {
    if (osrmTimeout.current) clearTimeout(osrmTimeout.current);
    osrmTimeout.current = setTimeout(fetchRoute, 2500);
    return () => clearTimeout(osrmTimeout.current);
  }, [fetchRoute]);

  // Guard: task coords are the bare minimum
  if (!hasValidTask) {
    return (
      <div style={{ height: 300, borderRadius: 24, background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#94a3b8' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #1e293b', borderTop: '3px solid #3b82f6', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontWeight: 600 }}>Location Data Unavailable</p>
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>No coordinates in mission record</p>
      </div>
    );
  }

  const renderMap = (isFull) => (
    <MapContainer
      center={mapCenter}
      zoom={isFull ? 16 : 14}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      {hasValidVol && <RotatingVolunteerMarker position={{ lat: vLat, lng: vLng }} heading={heading} />}
      <Marker position={[tLat, tLng]} icon={taskIcon} />
      {routePoints.length > 0 && (
        <Polyline positions={routePoints} color="#3b82f6" weight={isFull ? 6 : 4} opacity={0.7} />
      )}
      <MapBoundsHandler volunteerCoords={hasValidVol ? { lat: vLat, lng: vLng } : null} taskCoords={{ lat: tLat, lng: tLng }} />
    </MapContainer>
  );

  return (
    <>
      <div className="mt-4 rounded-3xl overflow-hidden bg-slate-900 relative shadow-xl" style={{ height: 300 }}>
        <div className="absolute top-4 left-4 z-[500] bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] font-bold text-white border border-white/10 flex items-center gap-2 pointer-events-none">
          <Zap className="w-3 h-3 text-blue-400" />
          {hasValidVol ? `${displayDistance} km` : 'GPS acquiring...'}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
          className="absolute top-4 right-4 z-[500] bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md p-3 rounded-2xl border-2 border-[#4ade80]/50 hover:border-[#4ade80] transition-all transform hover:scale-110 shadow-2xl active:scale-95"
          title="Fullscreen Map"
        >
          <Maximize2 className="w-5 h-5 text-[#4ade80]" />
        </button>

        <div className="w-full h-full">{renderMap(false)}</div>
      </div>

      {isFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col">
          <header className="p-4 bg-slate-900 flex items-center justify-between border-b border-white/5">
            <button onClick={() => setIsFullscreen(false)} className="text-white hover:bg-white/10 p-2 rounded-xl transition-colors">
              <X />
            </button>
            <span className="text-white font-bold">
              {hasValidVol ? `${displayDistance} km to target` : 'Mission Location'}
            </span>
            <div className="w-6" />
          </header>
          <div className="flex-1">{renderMap(true)}</div>
        </div>
      )}

      <style>{`
        .premium-volunteer-marker { display:flex; align-items:center; justify-content:center; }
        .marker-container { position:relative; width:40px; height:40px; transition:transform 0.5s ease-out; }
        .heading-beam { position:absolute; width:0; height:0; border-left:15px solid transparent; border-right:15px solid transparent; border-bottom:40px solid rgba(59,130,246,0.3); filter:blur(4px); top:-20px; left:5px; }
        .pulse-ring { position:absolute; width:20px; height:20px; left:10px; top:10px; border-radius:50%; background:rgba(59,130,246,0.3); animation:marker-pulse 2s infinite; }
        .marker-core { width:16px; height:16px; position:absolute; left:12px; top:12px; background:white; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.4); }
        .marker-blue-center { width:10px; height:10px; background:#3b82f6; border-radius:50%; }
        @keyframes marker-pulse { 0%{transform:scale(1);opacity:1} 100%{transform:scale(3);opacity:0} }
      `}</style>
    </>
  );
};

export default VolunteerTaskMap;