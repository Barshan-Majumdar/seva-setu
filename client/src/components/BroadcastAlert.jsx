import { useState, useEffect } from 'react';
import { Clock, MapPin, AlertTriangle, Check, X, Loader2 } from 'lucide-react';

const BroadcastAlert = ({ broadcast, onAccept, onReject, isBusy }) => {
  const [timeLeft, setTimeLeft] = useState('--m --s');
  const [isExpired, setIsExpired] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);

  useEffect(() => {
    // If no expires_at, show card but don't count down — just show placeholder
    if (!broadcast.expires_at) {
      setTimeLeft('30m 0s');
      return;
    }

    let expiryDate;
    try {
      expiryDate = new Date(broadcast.expires_at);
      if (isNaN(expiryDate.getTime())) {
        // Try replacing dashes for Safari/older browsers
        expiryDate = new Date(String(broadcast.expires_at).replace(/-/g, '/'));
      }
    } catch {
      setTimeLeft('30m 0s');
      return;
    }

    const expiresAt = expiryDate.getTime();
    if (isNaN(expiresAt)) {
      setTimeLeft('30m 0s');
      return;
    }

    const updateTimer = () => {
      const distance = expiresAt - Date.now();
      if (distance <= 0) {
        setIsExpired(true);
        setTimeLeft('0m 0s');
        return;
      }
      const m = Math.floor(distance / 60000);
      const s = Math.floor((distance % 60000) / 1000);
      setTimeLeft(`${m}m ${s}s`);
    };

    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [broadcast.expires_at]);

  if (isExpired) return null;

  const handleAccept = async () => {
    setLoadingAction('accept');
    try {
      await onAccept(broadcast.need_id);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReject = async () => {
    setLoadingAction('reject');
    try {
      await onReject(broadcast.need_id);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <article style={{
      background: '#ffffff',
      border: '1.5px solid rgba(244,63,94,0.25)',
      borderRadius: '1.25rem',
      overflow: 'hidden',
      boxShadow: '0 8px 30px rgba(244,63,94,0.08)',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(254,226,226,0.5)',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(244,63,94,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            background: '#f43f5e',
            padding: '0.35rem',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AlertTriangle style={{ width: 14, height: 14, color: '#fff' }} />
          </div>
          <h3 style={{
            fontSize: '0.6rem',
            fontWeight: 900,
            color: '#f43f5e',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            margin: 0,
          }}>Emergency Dispatch</h3>
        </div>

        {/* Timer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.25rem 0.6rem',
          borderRadius: '0.5rem',
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(244,63,94,0.2)',
          color: '#f43f5e',
          fontSize: '0.7rem',
          fontWeight: 900,
          fontFamily: 'monospace',
          minWidth: '70px',
          justifyContent: 'center',
        }}>
          <Clock style={{ width: 11, height: 11 }} />
          {timeLeft}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '1rem' }}>
        {/* Mission title */}
        <p style={{
          fontSize: '1rem',
          fontWeight: 900,
          color: '#0f172a',
          marginBottom: '0.85rem',
          lineHeight: 1.25,
        }}>{broadcast.title || 'New Mission'}</p>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1rem' }}>
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '0.85rem',
            padding: '0.65rem',
          }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Distance</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <MapPin style={{ width: 13, height: 13, color: '#2d6148', flexShrink: 0 }} />
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                {broadcast.distance_km != null ? Number(broadcast.distance_km).toFixed(2) : '—'}
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '2px' }}>km</span>
              </span>
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '0.85rem',
            padding: '0.65rem',
          }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Type & Urgency</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', textTransform: 'capitalize' }}>
                {broadcast.need_type || 'Other'}
              </span>
              <span style={{
                background: '#f43f5e',
                color: '#fff',
                fontSize: '0.6rem',
                fontWeight: 900,
                padding: '0.15rem 0.45rem',
                borderRadius: '0.35rem',
              }}>
                {Number(broadcast.urgency_score || 0).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            onClick={handleAccept}
            disabled={isBusy === broadcast.need_id}
            style={{
              flex: '2 1 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.8rem 0.5rem',
              borderRadius: '0.85rem',
              backgroundColor: '#2d6148',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '0.8rem',
              border: 'none',
              cursor: isBusy === broadcast.need_id ? 'not-allowed' : 'pointer',
              opacity: isBusy === broadcast.need_id ? 0.6 : 1,
              boxShadow: '0 6px 18px rgba(45,97,72,0.25)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            {loadingAction === 'accept'
              ? <Loader2 className="animate-spin" style={{ width: 15, height: 15 }} />
              : <Check style={{ width: 15, height: 15 }} />}
            Accept Mission
          </button>

          <button
            onClick={handleReject}
            disabled={isBusy === broadcast.need_id}
            style={{
              flex: '1 1 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              padding: '0.8rem 0.5rem',
              borderRadius: '0.85rem',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              fontWeight: 700,
              fontSize: '0.72rem',
              border: '1px solid #e2e8f0',
              cursor: isBusy === broadcast.need_id ? 'not-allowed' : 'pointer',
              opacity: isBusy === broadcast.need_id ? 0.6 : 1,
              transition: 'background 0.15s',
            }}
          >
            {loadingAction === 'reject'
              ? <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} />
              : <X style={{ width: 13, height: 13 }} />}
            Decline
          </button>
        </div>
      </div>
    </article>
  );
};

export default BroadcastAlert;
