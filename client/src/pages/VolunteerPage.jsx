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
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { useVolunteerApp } from '../hooks/useVolunteerApp';
import { volunteerStatusClass, volunteerStatusLabel } from '../utils/volunteer';
import CameraWatermark from '../components/CameraWatermark';

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
  } = useVolunteerApp();

  const [selectedFiles, setSelectedFiles] = useState({}); // { taskId: { file, preview } }
  const [verificationErrors, setVerificationErrors] = useState({}); // { taskId: message }

  const fileInputRefs = useRef({});

  const handleFileChange = async (taskId, file) => {
    console.log(`[handleFileChange] Task: ${taskId}, File:`, file);
    if (!file) return;
    
    // Check for GPS on the frontend immediately
    let hasGps = false;
    try {
      const gps = await exifr.gps(file);
      hasGps = !!(gps && gps.latitude && gps.longitude);
      console.log(`[handleFileChange] GPS Check for ${file.name}:`, hasGps ? 'FOUND' : 'MISSING');
    } catch (e) {
      console.warn('EXIF read error on frontend:', e);
    }

    setSelectedFiles(prev => {
      // Cleanup old preview to prevent memory leaks
      if (prev[taskId]?.preview) {
        URL.revokeObjectURL(prev[taskId].preview);
      }
      const preview = URL.createObjectURL(file);
      return {
        ...prev,
        [taskId]: { file, preview, hasGps }
      };
    });
    
    setVerificationErrors(prev => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  const onCompleteMission = async (task, file) => {
    console.log(`[VolunteerPage] Initiating completion for task ${task.task_id}...`);
    try {
      await completeTask(task, file);
      console.log(`[VolunteerPage] Task ${task.task_id} completed successfully.`);
      // If success, clear the file and error
      setSelectedFiles(prev => {
        if (prev[task.task_id]?.preview) {
          URL.revokeObjectURL(prev[task.task_id].preview);
        }
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
      console.error(`[VolunteerPage] Task ${task.task_id} completion failed:`, err);
      // Store the array of errors and status summary
      const errorsArray = err.response?.data?.errors;
      const statusSummary = err.response?.data?.statusSummary;
      const fallbackMsg = err.response?.data?.details || err.response?.data?.message || 'Verification failed. Please try a different photo.';
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
          <p className="landing-eyebrow">Volunteer Workspace</p>
          <h1 className="volunteer-title">Mobile mission console for field execution.</h1>
          <p className="volunteer-subtitle">
            Stay available, check in at incident sites, and close tasks with live status sync.
          </p>
        </section>

        <section className="volunteer-stats-grid">
          <article className="volunteer-stat card">
            <p className="volunteer-stat-label">Tasks Completed</p>
            <p className="volunteer-stat-value">{stats?.tasksCompleted ?? 0}</p>
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
            {tasks.map((task) => (
              <article key={task.task_id} className="card volunteer-task-card">
                <div className="volunteer-task-header">
                  <p className="font-semibold text-text-primary">{task.title}</p>
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

                <div className="volunteer-task-meta">
                  <span className="capitalize">{task.need_type}</span>
                  <span>{task.ward || '-'}, {task.district || '-'}</span>
                  <span>Urgency: {Number(task.urgency_score || 0).toFixed(2)}</span>
                </div>

                <div className="volunteer-task-actions">
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
                          
                          {/* GPS Integrity Badge */}
                          <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg backdrop-blur-md ${
                            selectedFiles[task.task_id].hasGps 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {selectedFiles[task.task_id].hasGps ? (
                              <Navigation className="w-3 h-3 fill-current" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            {selectedFiles[task.task_id].hasGps ? 'Geo-tagged' : 'No Location Data'}
                          </div>

                          <button 
                            className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors"
                            onClick={() => {
                              setSelectedFiles(prev => {
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
                            title="Remove image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {verificationErrors[task.task_id] && (
                        <div className="p-4 rounded-xl bg-[#1e1416] border border-accent-rose/30 shadow-lg shadow-black/20">
                          {/* Header */}
                          <div className="flex gap-3 mb-3">
                            <div className="bg-accent-rose/20 p-2 rounded-lg h-fit">
                              <AlertCircle className="w-5 h-5 text-accent-rose shrink-0" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-accent-rose uppercase tracking-widest opacity-80">Verification Rejected</p>
                              <p className="text-[11px] text-text-muted mt-0.5">
                                {(verificationErrors[task.task_id].errors || (Array.isArray(verificationErrors[task.task_id]) ? verificationErrors[task.task_id] : [verificationErrors[task.task_id]])).length} issue(s) detected
                              </p>
                            </div>
                          </div>
                          
                          {/* Status Summary Grid */}
                          {verificationErrors[task.task_id].summary && (
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold ${
                                verificationErrors[task.task_id].summary.geoTag === 'PASSED' 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              }`}>
                                <Navigation className="w-3.5 h-3.5" />
                                <span>GPS: {verificationErrors[task.task_id].summary.geoTag}</span>
                              </div>
                              <div className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold ${
                                verificationErrors[task.task_id].summary.aiContent === 'PASSED' 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              }`}>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>AI: {verificationErrors[task.task_id].summary.aiContent}</span>
                              </div>
                            </div>
                          )}

                          {/* Error Details */}
                          <div className="space-y-2 mb-3">
                            {(verificationErrors[task.task_id].errors || (Array.isArray(verificationErrors[task.task_id]) ? verificationErrors[task.task_id] : [verificationErrors[task.task_id]])).map((errMsg, idx) => (
                              <div key={idx} className="flex gap-2 items-start p-2.5 rounded-lg bg-black/30 border border-white/5">
                                <span className="text-accent-rose font-black text-xs mt-0.5 shrink-0">{idx + 1}.</span>
                                <p className="text-sm font-medium text-text-primary leading-snug">{errMsg}</p>
                              </div>
                            ))}
                          </div>

                          <button 
                            className="text-[10px] font-bold text-accent-rose/60 hover:text-accent-rose transition-colors uppercase tracking-wider"
                            onClick={() => setVerificationErrors(prev => {
                              const next = { ...prev };
                              delete next[task.task_id];
                              return next;
                            })}
                          >
                            Dismiss Feedback
                          </button>
                        </div>
                      )}

                      {!selectedFiles[task.task_id] ? (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveCameraTask(task.task_id);
                          }}
                          disabled={busyTaskId === task.task_id}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Capture Geo-tagged Proof
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-success w-full"
                          onClick={(e) => {
                            e.preventDefault();
                            onCompleteMission(task, selectedFiles[task.task_id].file);
                          }}
                          disabled={busyTaskId === task.task_id}
                        >
                          {busyTaskId === task.task_id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Sparkles className="w-5 h-5 fill-white/20" />
                          )}
                          <span>Verify & Complete Mission</span>
                        </button>
                      )}
                      
                      {!verificationErrors[task.task_id] && (
                        <p className="text-[10px] text-text-muted flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Ensure GPS/Location is ON in camera settings.
                        </p>
                      )}
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
            ))}

            {tasks.length === 0 ? (
              <article className="card volunteer-empty">
                <Sparkles className="w-5 h-5 text-text-muted" />
                <p className="text-sm text-text-secondary">No assigned tasks yet. Stay available for dispatch.</p>
              </article>
            ) : null}
          </section>
        ) : null}

        {activeTasks.length > 0 ? (
          <section className="card volunteer-bg-sync">
            <p className="text-xs text-text-secondary">
              Background location sync is active every 5 minutes while you have active tasks.
            </p>
          </section>
        ) : null}

        {toast ? (
          <div className={`dashboard-toast ${toast.type === 'error' ? 'is-error' : ''}`}>{toast.message}</div>
        ) : null}
      </div>

      {activeCameraTask && (
        <CameraWatermark 
          onCapture={(file) => {
            handleFileChange(activeCameraTask, file);
            setActiveCameraTask(null);
          }} 
          onCancel={() => setActiveCameraTask(null)} 
        />
      )}
    </MainLayout>
  );
};

export default VolunteerPage;
