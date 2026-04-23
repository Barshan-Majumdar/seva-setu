import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import { useVolunteerApp } from '../hooks/useVolunteerApp';
import { volunteerStatusClass, volunteerStatusLabel } from '../utils/volunteer';

const VolunteerPage = () => {
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
                  <span className={`volunteer-pill ${volunteerStatusClass(task.task_status)}`}>
                    {volunteerStatusLabel(task.task_status)}
                  </span>
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
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => completeTask(task)}
                      disabled={busyTaskId === task.task_id}
                    >
                      {busyTaskId === task.task_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      Mark Complete
                    </button>
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
    </MainLayout>
  );
};

export default VolunteerPage;
