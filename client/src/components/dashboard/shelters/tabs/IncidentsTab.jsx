import { useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Shield, CheckCircle2, Clock } from 'lucide-react';

const IncidentsTab = ({ shelter, manager }) => {
  const isCoordinator = true;
  const [showForm, setShowForm] = useState(false);
  const [newIncident, setNewIncident] = useState({ type: 'medical_emergency', description: '', severity: 1 });

  const handleReport = (e) => {
    e.preventDefault();
    if (newIncident.description) {
      manager.reportIncident(shelter.id, newIncident);
      setNewIncident({ type: 'medical_emergency', description: '', severity: 1 });
      setShowForm(false);
    }
  };

  const getSeverityColor = (severity) => {
    if (severity >= 4) return '#dc2626'; // Red
    if (severity >= 3) return '#ea580c'; // Orange
    if (severity === 2) return '#d97706'; // Amber
    return '#059669'; // Green
  };

  const getIncidentIcon = (type) => {
    switch (type) {
      case 'medical_emergency': return <AlertTriangle size={16} />;
      case 'security': return <Shield size={16} />;
      default: return <Clock size={16} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Incident Reports</h3>
        {isCoordinator && shelter.status !== 'closed' && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="dashboard-dispatch-btn-premium primary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
          >
            {showForm ? 'Cancel' : 'Report Incident'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleReport} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Type</label>
              <select 
                value={newIncident.type}
                onChange={e => setNewIncident({ ...newIncident, type: e.target.value })}
                style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
              >
                <option value="medical_emergency">Medical Emergency</option>
                <option value="security">Security Issue</option>
                <option value="resource_shortage">Resource Shortage</option>
                <option value="sanitation">Sanitation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Severity (1-5)</label>
              <input 
                type="number"
                min="1" max="5"
                value={newIncident.severity}
                onChange={e => setNewIncident({ ...newIncident, severity: parseInt(e.target.value, 10) || 1 })}
                style={{ width: '80px', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Description</label>
            <textarea 
              required
              rows="2"
              value={newIncident.description}
              onChange={e => setNewIncident({ ...newIncident, description: e.target.value })}
              style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="dashboard-dispatch-btn-premium primary" style={{ padding: '0.4rem 1rem' }}>
              Submit Report
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {shelter.incidents.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', background: '#f8fafc', borderRadius: '8px' }}>
            No incidents reported.
          </div>
        ) : (
          shelter.incidents.map(incident => (
            <div key={incident.id} style={{ display: 'flex', gap: '1rem', padding: '1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', opacity: incident.status === 'resolved' ? 0.6 : 1 }}>
              
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: incident.status === 'resolved' ? '#f1f5f9' : `${getSeverityColor(incident.severity)}15`, color: incident.status === 'resolved' ? '#94a3b8' : getSeverityColor(incident.severity), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {incident.status === 'resolved' ? <CheckCircle2 size={20} /> : getIncidentIcon(incident.type)}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
                      {incident.type.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: incident.status === 'resolved' ? '#f1f5f9' : `${getSeverityColor(incident.severity)}20`, color: incident.status === 'resolved' ? '#94a3b8' : getSeverityColor(incident.severity) }}>
                      Lvl {incident.severity}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {format(new Date(incident.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
                
                <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
                  {incident.description}
                </p>

                {isCoordinator && incident.status === 'open' && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => manager.resolveIncident(shelter.id, incident.id)}
                      style={{ padding: '0.3rem 0.75rem', borderRadius: '4px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default IncidentsTab;
