import { useState, useEffect } from 'react';
import { Clock, MapPin, AlertTriangle, Check, X, Loader2 } from 'lucide-react';

const BroadcastAlert = ({ broadcast, onAccept, onReject, isBusy }) => {
  const [timeLeft, setTimeLeft] = useState('0m 0s');
  const [isExpired, setIsExpired] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);

  useEffect(() => {
    if (!broadcast.expires_at) {
      setIsExpired(true);
      return;
    }

    // ROBUST DATE PARSING
    let expiryDate;
    try {
      const expiresAtRaw = broadcast.expires_at;
      if (!expiresAtRaw) {
        setIsExpired(true);
        return;
      }
      expiryDate = new Date(expiresAtRaw);
      if (isNaN(expiryDate.getTime()) && typeof expiresAtRaw === 'string') {
        expiryDate = new Date(expiresAtRaw.replace(/-/g, '/'));
      }
    } catch (e) {
      console.error('Date parse error:', e);
      setIsExpired(true);
      return;
    }

    const expiresAt = expiryDate.getTime();
    if (isNaN(expiresAt)) {
      setIsExpired(true);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = expiresAt - now;

      if (distance <= 0) {
        setIsExpired(true);
        setTimeLeft('0m 0s');
        return;
      }

      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);
      
      const minutes = isNaN(m) ? 0 : m;
      const seconds = isNaN(s) ? 0 : s;
      
      setTimeLeft(`${minutes}m ${seconds}s`);
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
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
    <article className="card bg-white border border-accent-rose/30 shadow-[0_8px_30px_rgba(244,63,94,0.08)] mb-6 overflow-hidden transition-all hover:shadow-[0_12px_40px_rgba(244,63,94,0.12)] w-full">
      <div className="bg-accent-rose-light/40 px-4 py-3 flex items-center justify-between border-b border-accent-rose/10">
        <div className="flex items-center gap-2">
          <div className="bg-accent-rose p-1.5 rounded-lg shadow-md shadow-accent-rose/20">
            <AlertTriangle className="w-3.5 h-3.5 text-white animate-pulse" />
          </div>
          <h3 className="font-black text-accent-rose uppercase tracking-widest text-[9px]">Emergency Dispatch</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm border border-accent-rose/20 text-accent-rose text-[10px] font-black font-mono shadow-sm min-w-[75px] justify-center">
          <Clock className="w-3 h-3" />
          {timeLeft}
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="text-lg font-black text-text-primary leading-tight mb-4">{broadcast.title}</p>
        
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-surface-secondary border border-border p-3 rounded-2xl flex flex-col gap-1">
            <span className="text-[8px] font-black text-text-muted uppercase tracking-wider">Distance</span>
            <div className="flex items-center gap-2 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-accent-moss" />
              <span className="text-base font-black text-text-primary">
                {broadcast.distance_km?.toFixed(2) || '0.00'} <span className="text-[10px] text-text-muted">km</span>
              </span>
            </div>
          </div>

          <div className="bg-surface-secondary border border-border p-3 rounded-2xl flex flex-col gap-1">
            <span className="text-[8px] font-black text-text-muted uppercase tracking-wider">Type & Urgency</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-black text-text-primary capitalize">{broadcast.need_type || 'Other'}</span>
              <span className="bg-accent-rose text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm shadow-accent-rose/20">
                {Number(broadcast.urgency_score || 0).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            disabled={isBusy === broadcast.need_id}
            className="flex-[2] btn-success flex justify-center items-center gap-2 py-3 rounded-xl text-xs font-black transition-all"
            style={{ 
              backgroundColor: '#2d6148', 
              color: '#ffffff',
              boxShadow: '0 8px 20px rgba(45, 97, 72, 0.2)'
            }}
          >
            {loadingAction === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Accept
          </button>
          <button
            onClick={handleReject}
            disabled={isBusy === broadcast.need_id}
            className="flex-1 py-3 px-2 rounded-xl font-bold text-[10px] bg-surface-secondary hover:bg-surface-hover text-text-muted border border-border transition-all flex justify-center items-center gap-1"
          >
            {loadingAction === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            Decline
          </button>
        </div>
      </div>
    </article>
  );
};

export default BroadcastAlert;
