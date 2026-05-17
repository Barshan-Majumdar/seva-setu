import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, AlertCircle, Clock, CheckCircle, XCircle, FileText, WifiOff } from 'lucide-react';
import api from '../services/api';
import { getQueuedNeedSubmissions } from '../services/offlineQueue';
import { io } from 'socket.io-client';

const ReporterStatusList = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchIssues();
    const socketUrl = import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') : 'http://localhost:5000';
    const socket = io(socketUrl);

    const handleRealtimeRefresh = () => {
      console.log('[SOCKET] Need state change detected. Refreshing submission history silently...');
      fetchIssues();
    };

    socket.on('need_created', handleRealtimeRefresh);
    socket.on('need_updated', handleRealtimeRefresh);

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      let onlineIssues = [];
      if (navigator.onLine) {
        try {
          const res = await api.get('/needs');
          onlineIssues = res.data;
        } catch (e) { console.error("Failed to fetch online issues:", e); }
      }
      const queued = await getQueuedNeedSubmissions();
      const offlineIssues = queued.map(q => ({
        id: `queued-${q.id}`,
        title: q.payload.title || 'Offline Draft',
        district: q.payload.district || 'Unknown',
        created_at: q.timestamp || new Date().toISOString(),
        status: 'queued'
      }));
      const combinedIssues = [...offlineIssues, ...onlineIssues];
      combinedIssues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setIssues(combinedIssues);
    } catch (err) {
      console.error('Failed to compile issues', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  const getStatusConfig = (status) => {
    switch (status) {
      case 'queued':
        return { icon: <WifiOff className="w-4 h-4" />, color: '#64748b', bg: 'rgba(71, 85, 105, 0.08)', border: 'rgba(71, 85, 105, 0.2)' };
      case 'pending':
        return { icon: <Clock className="w-4 h-4" />, color: '#d97706', bg: 'rgba(217, 119, 6, 0.08)', border: 'rgba(217, 119, 6, 0.2)' };
      case 'accepted':
      case 'assigned':
      case 'in_progress':
        return { icon: <CheckCircle className="w-4 h-4" />, color: '#2d6148', bg: 'rgba(45, 97, 72, 0.08)', border: 'rgba(45, 97, 72, 0.2)' };
      case 'completed':
        return { icon: <CheckCircle className="w-4 h-4" />, color: '#059669', bg: 'rgba(5, 150, 105, 0.08)', border: 'rgba(5, 150, 105, 0.2)' };
      case 'rejected':
        return { icon: <XCircle className="w-4 h-4" />, color: '#c35d51', bg: 'rgba(195, 93, 81, 0.08)', border: 'rgba(195, 93, 81, 0.2)' };
      default:
        return { icon: <FileText className="w-4 h-4" />, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.2)' };
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.9rem' }}>
        Loading submission history...
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <FileText style={{ width: 40, height: 40, margin: '0 auto 0.75rem', opacity: 0.4 }} />
        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>No reports submitted yet.</p>
        <p style={{ fontSize: '0.8rem', marginTop: '0.3rem', opacity: 0.7 }}>Your field reports will appear here once you submit them.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f171d', marginBottom: '1rem' }}>
        Submission History
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {issues.map(issue => {
          const config = getStatusConfig(issue.status);
          const isRejected = issue.status === 'rejected';
          const isExpanded = expandedId === issue.id;

          return (
            <div
              key={issue.id}
              className="card"
              style={{ overflow: 'hidden', borderRadius: '0.85rem', transition: 'box-shadow 0.2s' }}
            >
              <div
                style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: isRejected ? 'pointer' : 'default' }}
                onClick={() => isRejected && toggleExpand(issue.id)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f171d' }}>{issue.title}</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {new Date(issue.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {issue.district}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.25rem 0.7rem', borderRadius: 9999, fontSize: '0.65rem',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: config.color, background: config.bg,
                    border: `1px solid ${config.border}`,
                  }}>
                    {config.icon}
                    {issue.status}
                  </span>

                  {isRejected && (
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ color: '#94a3b8' }}
                    >
                      <ChevronDown style={{ width: 18, height: 18 }} />
                    </motion.div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && isRejected && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(15, 23, 29, 0.06)', background: 'rgba(195, 93, 81, 0.03)' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <div style={{ padding: '0.4rem', background: 'rgba(195, 93, 81, 0.1)', borderRadius: '0.5rem', flexShrink: 0 }}>
                          <AlertCircle style={{ width: 16, height: 16, color: '#c35d51' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c35d51', marginBottom: '0.35rem' }}>
                            Rejection Reason
                          </p>
                          <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6 }}>
                            {issue.rejection_reason || 'Image clarity insufficient or duplicate entry.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReporterStatusList;
