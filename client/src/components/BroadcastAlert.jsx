import { useState, useEffect } from 'react';
import { Clock, MapPin, AlertTriangle, Check, X, Loader2 } from 'lucide-react';

const BroadcastAlert = ({ broadcast, onAccept, onReject, isBusy }) => {
  const [timeLeft, setTimeLeft] = useState('--m --s');
  const [isExpired, setIsExpired] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);

  useEffect(() => {
    if (!broadcast.expires_at) {
      setTimeLeft('30m 0s');
      return;
    }

    let expiryDate;
    try {
      expiryDate = new Date(broadcast.expires_at);
      if (isNaN(expiryDate.getTime())) {
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
      border: '1px solid rgba(244,63,94,0.15)',
      borderRadius: '14px',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(244,63,94,0.06)',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(254,226,226,0.35)',
        padding: '0.65rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(244,63,94,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            background: '#f43f5e',
            padding: '0.3rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AlertTriangle style={{ width: 13, height: 13, color: '#fff' }} />
          </div>
          <h3 style={{
            fontSize: '0.6rem',
            fontWeight: 800,
            color: '#f43f5e',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            margin: 0,
          }}>Emergency Dispatch</h3>
        </div>

        {/* Timer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.2rem 0.55rem',
          borderRadius: '6px',
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(244,63,94,0.15)',
          color: '#f43f5e',
          fontSize: '0.675rem',
          fontWeight: 800,
          fontFamily: 'monospace',
          minWidth: '65px',
          justifyContent: 'center',
        }}>
          <Clock style={{ width: 10, height: 10 }} />
          {timeLeft}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '1rem' }}>
        {/* Mission title */}
        <p style={{
          fontSize: '0.95rem',
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: '0.75rem',
          lineHeight: 1.3,
          letterSpacing: '-0.01em',
          margin: '0 0 0.75rem 0',
        }}>{broadcast.title || 'New Mission'}</p>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.875rem' }}>
          <div style={{
            background: '#fafbfc',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            borderRadius: '10px',
            padding: '0.6rem 0.75rem',
          }}>
            <p style={{ fontSize: '0.575rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem', margin: '0 0 0.3rem 0' }}>Distance</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <MapPin style={{ width: 12, height: 12, color: '#2d6148', flexShrink: 0 }} />
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                {broadcast.distance_km != null ? Number(broadcast.distance_km).toFixed(2) : '—'}
                <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginLeft: '2px' }}>km</span>
              </span>
            </div>
          </div>

          <div style={{
            background: '#fafbfc',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            borderRadius: '10px',
            padding: '0.6rem 0.75rem',
          }}>
            <p style={{ fontSize: '0.575rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem', margin: '0 0 0.3rem 0' }}>Type & Urgency</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
                {broadcast.need_type || 'Other'}
              </span>
              <span style={{
                background: '#f43f5e',
                color: '#fff',
                fontSize: '0.575rem',
                fontWeight: 800,
                padding: '0.15rem 0.4rem',
                borderRadius: '5px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {Number(broadcast.urgency_score || 0).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleAccept}
            disabled={isBusy === broadcast.need_id}
            style={{
              flex: '2 1 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.7rem 0.5rem',
              borderRadius: '10px',
              backgroundColor: '#2d6148',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.78rem',
              border: 'none',
              cursor: isBusy === broadcast.need_id ? 'not-allowed' : 'pointer',
              opacity: isBusy === broadcast.need_id ? 0.6 : 1,
              boxShadow: '0 4px 12px rgba(45,97,72,0.2)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {loadingAction === 'accept'
              ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
              : <Check style={{ width: 14, height: 14 }} />}
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
              padding: '0.7rem 0.5rem',
              borderRadius: '10px',
              backgroundColor: '#fafbfc',
              color: '#64748b',
              fontWeight: 600,
              fontSize: '0.72rem',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              cursor: isBusy === broadcast.need_id ? 'not-allowed' : 'pointer',
              opacity: isBusy === broadcast.need_id ? 0.6 : 1,
              transition: 'all 200ms',
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
