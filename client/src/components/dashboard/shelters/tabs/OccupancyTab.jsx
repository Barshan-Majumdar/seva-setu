import { useState } from 'react';
import { format } from 'date-fns';

const OccupancyTab = ({ shelter, manager, isCoordinator = true }) => {
  const [newCount, setNewCount] = useState('');

  const handleLogOccupancy = (e) => {
    e.preventDefault();
    const count = parseInt(newCount, 10);
    if (!isNaN(count) && count >= 0) {
      manager.logOccupancy(shelter.id, count, 'u-admin');
      setNewCount('');
    }
  };

  const getOccupancyClass = (percent, status) => {
    if (status === 'closed' || status === 'archived') return 'bg-slate-200';
    if (percent >= 100) return 'shelter-occupancy-red';
    if (percent >= 70) return 'shelter-occupancy-amber';
    return 'shelter-occupancy-green';
  };

  // Prepare data for simple CSS sparkline (max 10 points)
  const logs = [...shelter.occupancyLogs].slice(-10);
  const maxLog = Math.max(shelter.capacityTotal, ...logs.map(l => l.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      
      {/* Live Capacity Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Live Occupancy</h3>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: shelter.isOvercrowded ? '#dc2626' : '#0f172a' }}>
            {shelter.occupancyCurrent} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>/ {shelter.capacityTotal}</span>
          </span>
        </div>
        
        <div className="shelter-occupancy-bar" style={{ height: '12px' }}>
          <div 
            className={`shelter-occupancy-fill ${getOccupancyClass(shelter.occupancyPercent, shelter.status)}`}
            style={{ width: `${Math.min(shelter.occupancyPercent, 100)}%` }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>0%</span>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: shelter.isOvercrowded ? 700 : 400, color: shelter.isOvercrowded ? '#dc2626' : '#64748b' }}>
            {shelter.occupancyPercent}%
          </span>
        </div>
      </div>

      {/* Log Form */}
      {isCoordinator && shelter.status !== 'closed' && (
        <form onSubmit={handleLogOccupancy} style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>New Count</label>
            <input 
              type="number"
              min="0"
              required
              value={newCount}
              onChange={e => setNewCount(e.target.value)}
              style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
              placeholder="e.g. 150"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button 
              type="submit"
              className="dashboard-dispatch-btn-premium primary"
              style={{ padding: '0.4rem 1rem' }}
            >
              Update
            </button>
          </div>
        </form>
      )}

      {/* Trend / History */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>Occupancy Trend</h3>
        
        {logs.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
            No occupancy logs recorded yet.
          </div>
        ) : (
          <div style={{ flex: 1, background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1rem', position: 'relative' }}>
            {/* Simple CSS Bar Chart representing the trend */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px', gap: '4px', position: 'relative', zIndex: 1 }}>
              {logs.map(log => {
                const heightPct = Math.max(5, (log.count / maxLog) * 100);
                const isOver = log.count >= shelter.capacityTotal;
                
                return (
                  <div key={log.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ fontSize: '0.6rem', color: isOver ? '#dc2626' : '#64748b', fontWeight: isOver ? 700 : 400 }}>{log.count}</div>
                    <div 
                      style={{ 
                        width: '100%', 
                        background: isOver ? '#dc2626' : '#3b82f6', 
                        height: `${heightPct}%`, 
                        borderRadius: '4px 4px 0 0',
                        opacity: 0.8
                      }} 
                      title={`${log.count} on ${format(new Date(log.reportedAt), 'PPp')}`}
                    />
                  </div>
                );
              })}
            </div>
            
            {/* Capacity Line */}
            <div style={{ 
              position: 'absolute', 
              top: `${100 - (shelter.capacityTotal / maxLog * 100)}%`, 
              left: 0, right: 0, 
              borderTop: '2px dashed #dc2626', 
              opacity: 0.5,
              pointerEvents: 'none',
              transform: 'translateY(16px)' // approx height of the top labels
            }} />
          </div>
        )}
        
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Recent Logs</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[...shelter.occupancyLogs].sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt)).slice(0, 5).map(log => (
              <li key={log.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px' }}>
                <span style={{ fontWeight: 600 }}>{log.count} people</span>
                <span style={{ color: '#64748b' }}>{format(new Date(log.reportedAt), 'MMM d, h:mm a')}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

    </div>
  );
};

export default OccupancyTab;
