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

  const icon = useMemo(() => L.divIcon({
    className: 'premium-volunteer-marker',
    html: `<div class="marker-container" style="transform: rotate(${heading || 0}deg);">
             <div class="heading-beam"></div>
             <div class="pulse-ring"></div>
             <div class="marker-core"><div class="marker-blue-center"></div></div>
           </div>`,
    iconSize: [40, 40], iconAnchor: [20, 20]
  }), [heading]);

  if (lat === null || lng === null) return null;

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
        const bounds = L.latLngBounds([ [vLat, vLng], [tLat, tLng] ]);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } else {
        map.setView([tLat, tLng], 15);
      }
      hasCentered.current = true;
    }
  }, [volunteerCoords, taskCoords, map]);

  return null;
};

const VolunteerTaskMap = ({
  taskLocation,
  volunteerLocation,
  taskCoords,
  volunteerCoords,
  heading = 0,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const actualTask = taskLocation || taskCoords;
  const actualVol = volunteerLocation || volunteerCoords;

  const tLat = safeNum(actualTask?.lat);
  const tLng = safeNum(actualTask?.lng);
  const vLat = safeNum(actualVol?.lat);
  const vLng = safeNum(actualVol?.lng);

  const hasTask = tLat !== null && tLng !== null;
  const hasVol = vLat !== null && vLng !== null;

  const distance = useMemo(() => {
    if (!hasTask || !hasVol) return null;
    return haversineKm({ lat: vLat, lng: vLng }, { lat: tLat, lng: tLng });
  }, [hasTask, hasVol, vLat, vLng, tLat, tLng]);

  if (!hasTask) {
    return (
      <div className="relative w-full h-64 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
        <span>No location data available for this task</span>
      </div>
    );
  }

  const polylinePositions = hasVol ? [[vLat, vLng], [tLat, tLng]] : [];

  return (
    <div className={`relative rounded-xl overflow-hidden border border-slate-200 transition-all ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full h-80'
    }`}>
      <MapContainer
        center={[tLat, tLng]}
        zoom={14}
        className="w-full h-full"
        style={{ width: '100%', height: '100%', minHeight: isFullscreen ? '100vh' : '320px' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hasVol && (
          <RotatingVolunteerMarker
            position={{ lat: vLat, lng: vLng }}
            heading={heading}
          />
        )}

        <Marker position={[tLat, tLng]} icon={taskIcon} />

        {polylinePositions.length > 0 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: '#2563eb', weight: 4, dashArray: '8, 8', opacity: 0.7 }}
          />
        )}

        <MapBoundsHandler
          volunteerCoords={hasVol ? { lat: vLat, lng: vLng } : null}
          taskCoords={{ lat: tLat, lng: tLng }}
        />
      </MapContainer>

      {/* Distance overlay pill */}
      {distance !== null && (
        <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md border border-slate-200/60 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Zap className="w-3.5 h-3.5 text-blue-600" />
          <span>{distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)}km away`}</span>
        </div>
      )}

      {/* Fullscreen toggle button */}
      <button
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm p-2 rounded-lg shadow-md border border-slate-200/60 hover:bg-slate-50 transition-colors"
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <X className="w-4 h-4 text-slate-700" /> : <Maximize2 className="w-4 h-4 text-slate-700" />}
      </button>

      {/* Custom Styles for Rotating Volunteer Marker */}
      <style>{`
        .premium-volunteer-marker {
          background: transparent !important;
          border: none !important;
        }
        .marker-container {
          position: relative;
          width: 40px;
          height: 40px;
          transition: transform 0.3s ease-out;
        }
        .marker-core {
          position: absolute;
          top: 10px;
          left: 10px;
          width: 20px;
          height: 20px;
          background: #2563eb;
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }
        .marker-blue-center {
          width: 6px;
          height: 6px;
          background: #ffffff;
          border-radius: 50%;
        }
        .pulse-ring {
          position: absolute;
          top: 4px;
          left: 4px;
          width: 32px;
          height: 32px;
          background: rgba(37, 99, 235, 0.25);
          border-radius: 50%;
          animation: mapMarkerPulse 2s ease-out infinite;
          z-index: 1;
        }
        .heading-beam {
          position: absolute;
          top: -12px;
          left: 14px;
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 14px solid #2563eb;
          filter: drop-shadow(0 2px 4px rgba(37, 99, 235, 0.4));
          z-index: 3;
        }
        @keyframes mapMarkerPulse {
          0% {
            transform: scale(0.6);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default VolunteerTaskMap;
