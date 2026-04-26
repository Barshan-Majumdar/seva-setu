import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, Loader2, UserCheck, Clock, FileText, Phone, User, Inbox } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';

const VolunteerApprovalsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const [toast, setToast] = useState(null);
  const initialLoadDone = useRef(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadRequests = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await api.get(`/volunteer-requests?status=${filter}`);
      setRequests(res.data);
    } catch (err) {
      console.error('Failed to load volunteer requests:', err);
    } finally {
      if (isInitial) setLoading(false);
      initialLoadDone.current = true;
    }
  }, [filter]);

  // Initial load + auto-poll every 10 seconds
  useEffect(() => {
    loadRequests(true);
    const interval = setInterval(() => loadRequests(false), 10000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const handleApprove = async (requestId) => {
    setProcessingId(requestId);
    try {
      await api.patch(`/volunteer-requests/${requestId}/approve`);
      setRequests(prev => prev.filter(r => r.id !== requestId));
      showToast('Volunteer approved and promoted successfully!');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to approve', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessingId(requestId);
    try {
      await api.patch(`/volunteer-requests/${requestId}/reject`, {
        review_note: 'Application did not meet the requirements at this time.',
      });
      setRequests(prev => prev.filter(r => r.id !== requestId));
      showToast('Application rejected.');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to reject', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const filterTabs = [
    { key: 'pending', label: 'Pending', icon: <Clock className="w-3.5 h-3.5" /> },
    { key: 'approved', label: 'Approved', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { key: 'rejected', label: 'Rejected', icon: <XCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <MainLayout>
      <div className="container-lg" style={{ paddingBlock: 'clamp(2rem, 2vw + 1.5rem, 3.5rem)', display: 'grid', gap: '1rem' }}>

        {/* Hero */}
        <section className="dashboard-hero" style={{ position: 'relative' }}>
          <p className="landing-eyebrow">Coordinator Panel</p>
          <h1 className="dashboard-title">Volunteer Approvals</h1>
          <p className="dashboard-subtitle">
            Review applications from community members who want to join as verified volunteers.
          </p>
        </section>

        {/* Filter Tabs */}
        <section className="dashboard-card" style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.5rem 1rem', borderRadius: '0.6rem',
                  fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: filter === tab.key ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  color: filter === tab.key ? '#38bdf8' : 'var(--color-text-secondary)',
                  border: filter === tab.key ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                  transition: 'all 200ms',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <section className="dashboard-card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="w-4 h-4 icon-spin" />
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Loading applications...</span>
          </section>
        )}

        {/* Empty State */}
        {!loading && requests.length === 0 && (
          <section className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '1rem',
              background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Inbox className="w-7 h-7" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              No {filter} applications at this time.
            </p>
          </section>
        )}

        {/* Request Cards */}
        {!loading && requests.length > 0 && (
          <section style={{ display: 'grid', gap: '0.75rem' }}>
            {requests.map((req) => (
              <article key={req.id} className="dashboard-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  {/* Applicant Info */}
                  <div style={{ flex: 1, minWidth: '250px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.15))',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, fontSize: '0.85rem', color: '#38bdf8',
                      }}>
                        {req.fullName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                          {req.fullName}
                        </p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {req.user?.email} • Applied {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Contact */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <Phone className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{req.contactDetails}</span>
                    </div>

                    {/* Proof of Work */}
                    <div style={{
                      padding: '0.85rem', borderRadius: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)',
                      marginTop: '0.5rem',
                    }}>
                      <p style={{
                        fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: '0.4rem',
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                      }}>
                        <FileText className="w-3 h-3" />
                        Proof of Work / Capability
                      </p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {req.proofOfWork}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  {filter === 'pending' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '140px' }}>
                      <button
                        type="button"
                        className="btn-success"
                        disabled={processingId === req.id}
                        onClick={() => handleApprove(req.id)}
                        style={{ fontSize: '0.8rem', padding: '0.6rem 1rem', justifyContent: 'center' }}
                      >
                        {processingId === req.id ? (
                          <Loader2 className="w-4 h-4 icon-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={processingId === req.id}
                        onClick={() => handleReject(req.id)}
                        style={{
                          fontSize: '0.8rem', padding: '0.6rem 1rem', justifyContent: 'center',
                          borderColor: 'rgba(251, 113, 133, 0.3)', color: '#fb7185',
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}

                  {filter !== 'pending' && (
                    <div style={{
                      padding: '0.4rem 0.8rem', borderRadius: '9999px', fontSize: '0.7rem',
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      background: filter === 'approved' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 113, 133, 0.1)',
                      color: filter === 'approved' ? '#34d399' : '#fb7185',
                      border: `1px solid ${filter === 'approved' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 113, 133, 0.3)'}`,
                    }}>
                      {filter}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}

        {/* Toast */}
        {toast && (
          <div className={`dashboard-toast ${toast.type === 'error' ? 'is-error' : ''}`}>
            {toast.message}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default VolunteerApprovalsPage;
