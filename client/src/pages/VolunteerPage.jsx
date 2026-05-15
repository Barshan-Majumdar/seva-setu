/* VOLUNTEER PAGE VERSION: 2.1 - ROBUST MAP LOADING */
import { useState, useRef } from 'react';
import exifr from 'exifr';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
  Navigation,
  Upload,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { useVolunteerApp, haversineKm } from '../hooks/useVolunteerApp';
import { volunteerStatusClass, volunteerStatusLabel } from '../utils/volunteer';
import CameraWatermark from '../components/CameraWatermark';
import VolunteerTaskMap from '../components/VolunteerTaskMap';
import BroadcastAlert from '../components/BroadcastAlert';

const VolunteerPage = () => {
  const [activeCameraTask, setActiveCameraTask] = useState(null);
  const {
    loading,
    error,
    tasks,
    stats,
    availability,
    busyTaskId,
    distanceCoveredKm,
    activeTasks,
    toggleAvailability,
    checkInTask,
    completeTask,
    toast,
    volunteerCoords,
    broadcasts,
    broadcastBusy,
    acceptBroadcastTask,
    rejectBroadcastTask,
  } = useVolunteerApp();

  const [selectedFiles, setSelectedFiles] = useState({}); // { taskId: { file, preview } }
  const [verificationErrors, setVerificationErrors] = useState({}); // { taskId: message }
  const galleryInputRefs = useRef({}); // { taskId: HTMLInputElement }

  const handleFileChange = async (taskId, file, hasGps) => {
    if (!file) return;
    
    // If hasGps was explicitly passed from Camera, use it. Otherwise check EXIF.
    let gpsStatus = hasGps;
    if (gpsStatus === undefined) {
      try {
        const gps = await exifr.gps(file);
        gpsStatus = !!(gps && gps.latitude && gps.longitude);
      } catch (e) {
        console.warn('EXIF read error:', e);
        gpsStatus = false;
      }
    }

    setSelectedFiles(prev => {
      if (prev[taskId]?.preview) {
        URL.revokeObjectURL(prev[taskId].preview);
      }
      const preview = URL.createObjectURL(file);
      return {
        ...prev,
        [taskId]: { file, preview, hasGps: gpsStatus }
      };
    });
    
    setVerificationErrors(prev => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const onCompleteMission = async (task, file) => {
    try {
      await completeTask(task, file);
      setSelectedFiles(prev => {
        if (prev[task.task_id]?.preview) URL.revokeObjectURL(prev[task.task_id].preview);
        const next = { ...prev };
        delete next[task.task_id];
        return next;
      });
      setVerificationErrors(prev => {
        const next = { ...prev };
        delete next[task.task_id];
        return next;
      });
    } catch (err) {
      const errorsArray = err.response?.data?.errors;
      const statusSummary = err.response?.data?.statusSummary;
      const fallbackMsg = err.response?.data?.details || err.response?.data?.message || 'Verification failed.';
      setVerificationErrors(prev => ({
        ...prev,
        [task.task_id]: {
          errors: errorsArray && errorsArray.length > 0 ? errorsArray : [fallbackMsg],
          summary: statusSummary || null
        }
      }));
    }
  };

  return (
    <MainLayout>
      <div className="container-lg volunteer-shell">
        <section className="volunteer-hero card">
          <p className="landing-eyebrow">Volunteer Workspace v2.1</p>
          <h1 className="volunteer-title">Mobile mission console for field execution.</h1>
          <div className="flex gap-4 mt-2 text-[10px] font-mono text-text-muted opacity-50">
            {/* <span>LAT: {volunteerCoords?.lat?.toFixed(5) || 'N/A'}</span>
            <span>LNG: {volunteerCoords?.lng?.toFixed(5) || 'N/A'}</span>
            <span>ACC: {distanceCoveredKm.toFixed(2)}km</span> */}
          </div>
          <p className="volunteer-subtitle">
            Stay available, check in at incident sites, and close tasks with live status sync.
          </p>
        </section>

        {broadcasts.length > 0 && (
          <section className="volunteer-broadcasts">
            {broadcasts.map(broadcast => (
              <BroadcastAlert
                key={broadcast.broadcast_id}
                broadcast={broadcast}
                onAccept={acceptBroadcastTask}
                onReject={rejectBroadcastTask}
                isBusy={broadcastBusy}
              />
            ))}
          </section>
        )}

        <section className="volunteer-stats-grid">
          <article className="volunteer-stat card">
            <p className="volunteer-stat-label">Total Impact</p>
            <p className="volunteer-stat-value">{stats?.totalImpact ?? 0}</p>
          </article>
          <article className="volunteer-stat card">
            <p className="volunteer-stat-label">Completion Rate</p>
            <p className="volunteer-stat-value">{Math.round((stats?.completionRate ?? 0) * 100)}%</p>
          </article>
          <article className="volunteer-stat card">
            <p className="volunteer-stat-label">Distance Covered</p>
            <p className="volunteer-stat-value">{distanceCoveredKm.toFixed(2)} km</p>
          </article>
        </section>

        <section className="card volunteer-availability">
          <div>
            <p className="volunteer-stat-label">Availability</p>
            <p className="text-sm text-text-secondary mt-1">
              {availability ? 'You are available for new assignments' : 'You are currently unavailable'}
            </p>
          </div>
          <button type="button" className="volunteer-toggle-btn" onClick={toggleAvailability}>
            {availability ? <ToggleRight className="w-5 h-5 text-accent-green" /> : <ToggleLeft className="w-5 h-5" />}
            {availability ? 'ON' : 'OFF'}
          </button>
        </section>

        {loading ? (
          <section className="card volunteer-loading">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading tasks...
          </section>
        ) : null}

        {error ? (
          <section className="card volunteer-error">
            <AlertCircle className="w-4 h-4" />
            {error}
          </section>
        ) : null}

        {!loading && !error ? (
          <section className="volunteer-task-list">
            {tasks.map((task) => {
              const formatAssignedTime = (dateString) => {
                if (!dateString) return '';
                const date = new Date(dateString);
                const now = new Date();
                const diffTime = Math.abs(now - date);
                const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
                
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const diffDaysCal = Math.floor((today - taskDate) / (1000 * 60 * 60 * 24));
                
                if (diffDaysCal === 0) {
                  if (diffHours === 0) {
                    const diffMins = Math.floor(diffTime / (1000 * 60));
                    return diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`;
                  }
                  return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
                } else if (diffDaysCal === 1) {
                  return 'Yesterday';
                } else {
                  return date.toLocaleDateString();
                }
              };

              return (
              <article key={task.task_id} className="card volunteer-task-card">
                <div className="volunteer-task-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <p className="font-semibold text-text-primary">{task.title}</p>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--color-surface-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      • {formatAssignedTime(task.assigned_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.is_completion_verified && (
                      <span className="badge-verified flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        AI VERIFIED
                      </span>
                    )}
                    <span className={`volunteer-pill ${volunteerStatusClass(task.task_status)}`}>
                      {volunteerStatusLabel(task.task_status)}
                    </span>
                  </div>
                </div>

                {task.task_status !== 'completed' && (
                  <div className="volunteer-task-meta">
                    <span className="task-meta-tag capitalize">{task.need_type}</span>
                    <span className="task-meta-tag">{task.ward || 'Zone'}, {task.district || 'City'}</span>
                    <span className="task-meta-tag">Urgency: {Number(task.urgency_score || 0).toFixed(2)}</span>
                    
                    {/* DISTANCE BADGE: only show if we have real numeric coords */}
                    {(() => {
                      const tLat = Number(task.lat);
                      const tLng = Number(task.lng);
                      const vLat = Number(volunteerCoords?.lat);
                      const vLng = Number(volunteerCoords?.lng);
                      const hasVolCoords = isFinite(vLat) && isFinite(vLng);
                      const hasTaskCoords = isFinite(tLat) && isFinite(tLng);

                      if (hasVolCoords && hasTaskCoords) {
                        const dist = haversineKm({ lat: vLat, lng: vLng }, { lat: tLat, lng: tLng });
                        return (
                          <span className="task-meta-tag-distance">
                            <Navigation className="w-3 h-3" />
                            {dist.toFixed(2)} km away
                          </span>
                        );
                      }
                      if (task.server_distance_km != null && isFinite(Number(task.server_distance_km))) {
                        return (
                          <span className="task-meta-tag-distance">
                            <Navigation className="w-3 h-3" />
                            {Number(task.server_distance_km).toFixed(2)} km away
                          </span>
                        );
                      }
                      return null; // No GPS yet — show nothing rather than NaN
                    })()}
                  </div>
                )}

                {/* SHOW MAP AND CONTACT INFO for IN PROGRESS tasks */}
                {task.task_status === 'in_progress' && (
                  <div className="mt-3">
                    {(task.contact_number || task.contactNumber) ? (
                      <div className="volunteer-contact-card">
                        <div>
                          <p className="volunteer-contact-label">Reporter Contact</p>
                          <p className="volunteer-contact-number">{task.contact_number || task.contactNumber}</p>
                        </div>
                        <a
                          href={`tel:${(task.contact_number || task.contactNumber).replace(/\D/g, '')}`}
                          className="volunteer-call-btn"
                        >
                          Call
                        </a>
                      </div>
                    ) : (
                      <div className="hidden">No contact info available</div>
                    )}
                    {task.lat != null && task.lng != null && !isNaN(Number(task.lat)) && !isNaN(Number(task.lng)) ? (
                        <VolunteerTaskMap
                          volunteerCoords={volunteerCoords}
                          taskCoords={{ lat: Number(task.lat), lng: Number(task.lng) }}
                        />
                      ) : (
                        <div className="volunteer-map-loading">
                          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#2d6148' }} />
                          <p style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>Location Data Unavailable</p>
                          <p style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Coordinates missing from mission record</p>
                        </div>
                      )}
                  </div>
                )}

                <div className="volunteer-task-actions mt-4">
                  {task.task_status === 'assigned' ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => checkInTask(task)}
                      disabled={busyTaskId === task.task_id}
                    >
                      {busyTaskId === task.task_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                      Check In
                    </button>
                  ) : null}

                  {task.task_status === 'in_progress' ? (
                    <div className="flex flex-col gap-3 w-full">
                      {selectedFiles[task.task_id] && (
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-surface-secondary border border-border-subtle group">
                          <img 
                            src={selectedFiles[task.task_id].preview} 
                            className="w-full h-full object-cover" 
                            alt="Completion proof" 
                          />

                          {/* GPS Tag — Top Left */}
                          <div style={{
                            position: 'absolute',
                            top: '10px',
                            left: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            backdropFilter: 'blur(10px)',
                            background: selectedFiles[task.task_id].hasGps ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                            border: selectedFiles[task.task_id].hasGps ? '1px solid rgba(16,185,129,0.6)' : '1px solid rgba(239,68,68,0.6)',
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: selectedFiles[task.task_id].hasGps ? '#34d399' : '#f87171',
                          }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {selectedFiles[task.task_id].hasGps
                                ? <><MapPin style={{ width: 11, height: 11 }} /> GPS VERIFIED</>
                                : <><AlertCircle style={{ width: 11, height: 11 }} /> NO GPS</>}
                            </span>
                          </div>

                          {/* X Close — Top Right */}
                          <button
                            onClick={() => {
                              setSelectedFiles(prev => {
                                if (prev[task.task_id]?.preview) URL.revokeObjectURL(prev[task.task_id].preview);
                                const next = { ...prev };
                                delete next[task.task_id];
                                return next;
                              });
                              setVerificationErrors(prev => {
                                const next = { ...prev };
                                delete next[task.task_id];
                                return next;
                              });
                            }}
                            style={{
                              position: 'absolute',
                              top: '10px',
                              right: '10px',
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'rgba(0,0,0,0.6)',
                              backdropFilter: 'blur(8px)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {verificationErrors[task.task_id] && (
                        <div className="volunteer-verify-error">
                          <div className="volunteer-verify-error-title">
                            <AlertCircle style={{ width: 16, height: 16 }} />
                            Verification Failed
                          </div>

                          {verificationErrors[task.task_id].summary && (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                              <span style={{
                                padding: '4px 10px', borderRadius: '6px', fontSize: '10px',
                                fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                background: verificationErrors[task.task_id].summary.geoTag === 'GPS VERIFIED' 
                                  ? (selectedFiles[task.task_id]?.hasGps ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.1)')
                                  : 'rgba(195,93,81,0.1)',
                                color: verificationErrors[task.task_id].summary.geoTag === 'GPS VERIFIED' 
                                  ? (selectedFiles[task.task_id]?.hasGps ? '#059669' : '#d97706')
                                  : '#c35d51',
                                border: verificationErrors[task.task_id].summary.geoTag === 'GPS VERIFIED' 
                                  ? (selectedFiles[task.task_id]?.hasGps ? '1px solid rgba(5,150,105,0.25)' : '1px solid rgba(217,119,6,0.25)')
                                  : '1px solid rgba(195,93,81,0.25)',
                              }}>
                                GEO-TAG: {verificationErrors[task.task_id].summary.geoTag === 'GPS VERIFIED' 
                                  ? (selectedFiles[task.task_id]?.hasGps ? 'GPS VERIFIED' : 'NO PHOTO GPS (DEVICE PROXIMITY OK)') 
                                  : 'FAILED'}
                              </span>
                              <span style={{
                                padding: '4px 10px', borderRadius: '6px', fontSize: '10px',
                                fontWeight: 'bold', fontFamily: 'monospace', textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                background: verificationErrors[task.task_id].summary.aiContent === 'PASSED' ? 'rgba(5,150,105,0.1)' : 'rgba(195,93,81,0.1)',
                                color: verificationErrors[task.task_id].summary.aiContent === 'PASSED' ? '#059669' : '#c35d51',
                                border: verificationErrors[task.task_id].summary.aiContent === 'PASSED' ? '1px solid rgba(5,150,105,0.25)' : '1px solid rgba(195,93,81,0.25)',
                              }}>
                                AI CONTENT: {verificationErrors[task.task_id].summary.aiContent}
                              </span>
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {(verificationErrors[task.task_id].errors || []).map((err, i) => (
                              <div key={i} className="volunteer-verify-error-item">
                                {err.replace(/\s*\(?Confidence:\s*\d+(\.\d+)?%?\)?/i, '').trim()}
                              </div>
                            ))}
                          </div>
                          <p className="volunteer-verify-hint">
                            {verificationErrors[task.task_id].summary?.aiContent === 'FAILED'
                              ? 'Ensure the photo clearly shows relief work — such as rescue operations, aid distribution, or medical assistance at the site.'
                              : 'Move closer to the incident location and try again with GPS enabled.'}
                          </p>
                        </div>
                      )}

                      {/* PRIMARY ACTION BUTTONS */}
                      <div className="mt-4 pb-2" style={{ width: '100%' }}>
                        {!selectedFiles[task.task_id] ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {/* Option 1: Live Camera */}
                            <button
                              type="button"
                              className="btn-primary w-full"
                              style={{ minHeight: '50px' }}
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveCameraTask(task.task_id);
                              }}
                              disabled={busyTaskId === task.task_id}
                            >
                              <ShieldCheck className="w-4 h-4" />
                              Capture Proof
                            </button>

                            {/* Divider */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.15rem 0' }}>
                              <div style={{ flex: 1, height: 1, background: 'rgba(15, 23, 29, 0.08)' }} />
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>or</span>
                              <div style={{ flex: 1, height: 1, background: 'rgba(15, 23, 29, 0.08)' }} />
                            </div>

                            {/* Option 2: Gallery Upload */}
                            <input
                              ref={el => { galleryInputRefs.current[task.task_id] = el; }}
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleFileChange(task.task_id, e.target.files[0]);
                                }
                                e.target.value = '';
                              }}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                galleryInputRefs.current[task.task_id]?.click();
                              }}
                              disabled={busyTaskId === task.task_id}
                              style={{
                                width: '100%', minHeight: '50px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                padding: '0.75rem 1rem', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                                border: '2px dashed rgba(71, 85, 105, 0.2)', background: 'rgba(71, 85, 105, 0.02)',
                                color: '#475569', fontWeight: 700, fontSize: '0.875rem',
                              }}
                            >
                              <Upload style={{ width: 16, height: 16 }} />
                              Upload from Gallery
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            style={{
                              width: '100%',
                              minHeight: '60px',
                              backgroundColor: '#2d6148',
                              color: 'white',
                              borderRadius: '12px',
                              fontWeight: '800',
                              fontSize: '1rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '12px',
                              boxShadow: '0 10px 25px rgba(45, 97, 72, 0.3)',
                              border: '2px solid rgba(255, 255, 255, 0.2)',
                              cursor: 'pointer',
                              zIndex: 10,
                              position: 'relative'
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              onCompleteMission(task, selectedFiles[task.task_id].file);
                            }}
                            disabled={busyTaskId === task.task_id}
                          >
                            {busyTaskId === task.task_id ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              <Sparkles className="w-6 h-6" />
                            )}
                            VERIFY & COMPLETE MISSION
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {task.task_status === 'completed' ? (
                    <div className="volunteer-celebration">
                      <CheckCircle2 className="w-4 h-4" />
                      Completed mission
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}

            {tasks.length === 0 ? (
              <article className="card volunteer-empty">
                <Sparkles className="w-5 h-5 text-text-muted" />
                <p className="text-sm text-text-secondary">No assigned tasks yet.</p>
              </article>
            ) : null}
          </section>
        ) : null}

        {toast ? (
          <div className={`dashboard-toast ${toast.type === 'error' ? 'is-error' : ''}`}>{toast.message}</div>
        ) : null}
      </div>

      {activeCameraTask && (
        <CameraWatermark 
          onCapture={(file, hasGps) => {
            handleFileChange(activeCameraTask, file, hasGps);
            setActiveCameraTask(null);
          }} 
          onCancel={() => setActiveCameraTask(null)} 
        />
      )}
    </MainLayout>
  );
};

export default VolunteerPage;
