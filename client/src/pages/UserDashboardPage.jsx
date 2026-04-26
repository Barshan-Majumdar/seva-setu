import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, UserCheck, Loader2, Clock, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ReporterStatusList from '../components/ReporterStatusList';
import VolunteerApplicationModal from '../components/VolunteerApplicationModal';
import api from '../services/api';

const UserDashboardPage = () => {
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState('loading'); // 'loading' | 'none' | 'pending' | 'approved' | 'rejected'
  const [statusData, setStatusData] = useState(null);
  const navigate = useNavigate();
  const prevStatusRef = useRef(null);

  const fetchApplicationStatus = useCallback(async () => {
    try {
      const res = await api.get('/volunteer-requests/my-status');
      const newStatus = res.data.status;

      // Auto-redirect when status flips to approved (real-time!)
      if (prevStatusRef.current === 'pending' && newStatus === 'approved') {
        localStorage.removeItem('dbRole');
        window.location.href = '/post-login';
        return;
      }

      prevStatusRef.current = newStatus;
      setApplicationStatus(newStatus);
      setStatusData(res.data);
    } catch (err) {
      console.error('Failed to fetch application status:', err);
      setApplicationStatus('none');
    }
  }, []);

  // Initial load + auto-poll every 10 seconds
  useEffect(() => {
    fetchApplicationStatus();
    const interval = setInterval(fetchApplicationStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchApplicationStatus]);

  const handleApplicationSubmitted = () => {
    setShowApplicationModal(false);
    setApplicationStatus('pending');
  };

  const getStatusConfig = () => {
    switch (applicationStatus) {
      case 'pending':
        return {
          icon: <Clock className="w-5 h-5" />,
          label: 'Application Pending',
          description: 'Your volunteer application is being reviewed by a coordinator. You will be notified once a decision is made.',
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.08)',
          border: 'rgba(245, 158, 11, 0.25)',
        };
      case 'approved':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          label: 'Application Approved!',
          description: 'Congratulations! Your application has been approved. Please refresh or re-login to access the Volunteer Dashboard.',
          color: '#34d399',
          bg: 'rgba(52, 211, 153, 0.08)',
          border: 'rgba(52, 211, 153, 0.25)',
        };
      case 'rejected':
        return {
          icon: <XCircle className="w-5 h-5" />,
          label: 'Application Declined',
          description: statusData?.reviewNote || 'Your application did not meet the requirements. You may re-apply after addressing the feedback.',
          color: '#fb7185',
          bg: 'rgba(251, 113, 133, 0.08)',
          border: 'rgba(251, 113, 133, 0.25)',
        };
      default:
        return null;
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <MainLayout>
      <div className="user-dashboard-shell container-lg">

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="user-dashboard-hero card">
          <p className="landing-eyebrow">Community Dashboard</p>
          <h1 className="user-dashboard-title">
            Report incidents. Track progress. Make an impact.
          </h1>
          <p className="user-dashboard-subtitle">
            You can report community needs and track their status. Want to do more? Apply to become a verified volunteer.
          </p>
        </section>

        {/* ── Quick Actions ──────────────────────────────────── */}
        <section className="user-dashboard-actions-grid">
          <Link to="/field" className="user-dashboard-action-card card">
            <div className="user-dashboard-action-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.2)' }}>
              <Plus className="w-6 h-6" style={{ color: '#38bdf8' }} />
            </div>
            <div>
              <h3 className="user-dashboard-action-title">Report New Incident</h3>
              <p className="user-dashboard-action-desc">Submit a new community need with live photo & GPS verification.</p>
            </div>
            <ArrowRight className="w-4 h-4 user-dashboard-action-arrow" />
          </Link>

          <Link to="/my-reports" className="user-dashboard-action-card card">
            <div className="user-dashboard-action-icon" style={{ background: 'rgba(167, 139, 250, 0.1)', borderColor: 'rgba(167, 139, 250, 0.2)' }}>
              <FileText className="w-6 h-6" style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h3 className="user-dashboard-action-title">My Reports</h3>
              <p className="user-dashboard-action-desc">Track the live status of all your reported incidents.</p>
            </div>
            <ArrowRight className="w-4 h-4 user-dashboard-action-arrow" />
          </Link>
        </section>

        {/* ── Volunteer Application Status / CTA ─────────────── */}
        <section className="user-dashboard-volunteer-section card">
          <div className="user-dashboard-volunteer-header">
            <div className="user-dashboard-volunteer-icon-wrap">
              <UserCheck className="w-7 h-7" style={{ color: '#34d399' }} />
            </div>
            <div>
              <h2 className="user-dashboard-volunteer-title">Become a Volunteer</h2>
              <p className="user-dashboard-volunteer-desc">
                Join verified volunteers on the ground. Accept missions, check in at incident sites, and close tasks with AI-verified proof.
              </p>
            </div>
          </div>

          {applicationStatus === 'loading' ? (
            <div className="user-dashboard-status-loading">
              <Loader2 className="w-4 h-4 icon-spin" />
              <span>Checking application status...</span>
            </div>
          ) : applicationStatus === 'none' || applicationStatus === 'rejected' ? (
            <div>
              {applicationStatus === 'rejected' && statusConfig && (
                <div className="user-dashboard-status-banner" style={{ background: statusConfig.bg, borderColor: statusConfig.border, marginBottom: '1rem' }}>
                  <div style={{ color: statusConfig.color, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {statusConfig.icon}
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{statusConfig.label}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>{statusConfig.description}</p>
                </div>
              )}
              <button
                type="button"
                className="btn-primary user-dashboard-apply-btn"
                onClick={() => setShowApplicationModal(true)}
              >
                <UserCheck className="w-4 h-4" />
                {applicationStatus === 'rejected' ? 'Re-Apply as Volunteer' : 'Switch to Volunteer'}
              </button>
            </div>
          ) : statusConfig ? (
            <div className="user-dashboard-status-banner" style={{ background: statusConfig.bg, borderColor: statusConfig.border }}>
              <div style={{ color: statusConfig.color, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {statusConfig.icon}
                <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{statusConfig.label}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>{statusConfig.description}</p>
              {applicationStatus === 'approved' && (
                <button
                  type="button"
                  className="btn-success"
                  style={{ marginTop: '1rem' }}
                  onClick={() => {
                    localStorage.removeItem('dbRole');
                    window.location.href = '/post-login';
                  }}
                >
                  <ArrowRight className="w-4 h-4" />
                  Go to Volunteer Dashboard
                </button>
              )}
            </div>
          ) : null}
        </section>

        {/* ── Inline Reports ───────────────────────────────────── */}
        <section className="user-dashboard-reports-section">
          <ReporterStatusList />
        </section>
      </div>

      {showApplicationModal && (
        <VolunteerApplicationModal
          onClose={() => setShowApplicationModal(false)}
          onSubmitted={handleApplicationSubmitted}
        />
      )}
    </MainLayout>
  );
};

export default UserDashboardPage;
