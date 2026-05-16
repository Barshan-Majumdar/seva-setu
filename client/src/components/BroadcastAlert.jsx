import { useState, useEffect } from 'react';
import { Clock, MapPin, AlertTriangle, Check, X, Loader2 } from 'lucide-react';

const BroadcastAlert = ({ broadcast, onAccept, onReject, isBusy }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const expiresAt = new Date(broadcast.expires_at).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = expiresAt - now;

      if (distance <= 0) {
        setIsExpired(true);
        setTimeLeft('Expired');
        return;
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes}m ${seconds}s`);
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [broadcast.expires_at]);

  const [loadingAction, setLoadingAction] = useState(null);

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
    <article className="card bg-white border border-accent-rose/30 shadow-[0_8px_30px_rgb(244,63,94,0.08)] mb-6 overflow-hidden transition-all hover:shadow-[0_12px_40px_rgb(244,63,94,0.12)]">
      <div className="bg-accent-rose-light/40 px-5 py-3 flex items-center justify-between border-b border-accent-rose/10">
        <div className="flex items-center gap-2.5">
          <div className="bg-accent-rose p-1.5 rounded-lg shadow-lg shadow-accent-rose/20">
            <AlertTriangle className="w-4 h-4 text-white animate-pulse" />
          </div>
          <h3 className="font-black text-accent-rose uppercase tracking-widest text-[10px]">Emergency Dispatch</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 backdrop-blur-sm border border-accent-rose/20 text-accent-rose text-[10px] font-black font-mono shadow-sm">
          <Clock className="w-3 h-3" />
          {timeLeft}
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-lg font-extrabold text-text-primary leading-tight mb-3">{broadcast.title}</p>
        
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-secondary border border-border text-[11px] font-bold text-text-secondary">
            <MapPin className="w-3 h-3 text-accent-moss" />
            {broadcast.distance_km?.toFixed(1) || '?'} km away
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-secondary border border-border text-[11px] font-bold text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-rose animate-pulse" />
            Urgency: {Number(broadcast.urgency_score || 0).toFixed(1)}
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={handleAccept}
            disabled={isBusy === broadcast.need_id}
            className="flex-[2.5] bg-accent-moss hover:bg-accent-moss-dark text-white shadow-xl shadow-accent-moss/20 flex justify-center items-center gap-2 py-3 rounded-xl text-sm font-black transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            {loadingAction === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Accept Mission
          </button>
          <button
            onClick={handleReject}
            disabled={isBusy === broadcast.need_id}
            className="flex-1 py-3 px-3 rounded-xl font-bold text-[11px] bg-surface-secondary hover:bg-surface-hover text-text-muted border border-border transition-all flex justify-center items-center gap-1.5"
          >
            {loadingAction === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            Decline
          </button>
        </div>
      </div>
    </article>
  );
};

export default BroadcastAlert;
