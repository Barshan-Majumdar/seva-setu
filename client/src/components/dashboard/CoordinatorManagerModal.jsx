import { useState, useEffect } from 'react';
import { X, ShieldAlert, Trash2, Loader2, Plus, AlertCircle } from 'lucide-react';
import { fetchCoordinators, addCoordinator, removeCoordinator } from '../../services/dashboard';
import { useAuth } from '../../hooks/useAuth';

const CoordinatorManagerModal = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadCoordinators = async () => {
    try {
      setLoading(true);
      const data = await fetchCoordinators();
      setCoordinators(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load coordinators');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoordinators();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setActionLoading(true);
    try {
      await addCoordinator(emailInput.trim());
      setSuccessMsg(`Added ${emailInput} to coordinators.`);
      setEmailInput('');
      await loadCoordinators();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add coordinator');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (id, email) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from coordinators? They will become a volunteer.`)) return;
    
    setError('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      await removeCoordinator(id);
      setSuccessMsg(`Removed ${email} from coordinators.`);
      await loadCoordinators();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove coordinator');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose}>
      <div className="dashboard-modal" style={{ maxWidth: '600px', backgroundColor: 'var(--color-surface-card)', borderRadius: '1rem', border: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="dashboard-modal-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(45, 97, 72, 0.06)', borderRadius: '10px', color: '#2d6148', border: '1px solid rgba(45, 97, 72, 0.12)' }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="dashboard-card-title" style={{ margin: 0, fontSize: '1.05rem' }}>Manage Coordinators</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>Add or remove coordinator access for users.</p>
            </div>
          </div>
          <button className="dashboard-th-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: 'rgba(251, 113, 133, 0.1)', border: '1px solid rgba(251, 113, 133, 0.3)', borderRadius: '0.5rem', color: '#fb7185', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}
        
        {successMsg && (
          <div style={{ padding: '0.75rem', background: 'rgba(45, 97, 72, 0.08)', border: '1px solid rgba(45, 97, 72, 0.2)', borderRadius: '0.5rem', color: '#2d6148', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ShieldAlert size={16} /> {successMsg}
          </div>
        )}

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Enter email to grant access..."
            style={{ flex: 1, padding: '0.75rem', background: 'var(--color-surface-secondary)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', color: 'var(--color-text-primary)' }}
            disabled={actionLoading}
          />
          <button type="submit" className="dashboard-dispatch-btn-premium primary" style={{ padding: '0.5rem 1rem' }} disabled={actionLoading || !emailInput}>
            {actionLoading ? <Loader2 size={16} className="icon-spin" /> : <Plus size={16} />}
            Add
          </button>
        </form>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>Current Coordinators ({coordinators.length})</h3>
          
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', padding: '1rem', justifyContent: 'center' }}>
              <Loader2 size={18} className="icon-spin" /> Loading...
            </div>
          ) : coordinators.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'var(--color-surface-secondary)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
              No coordinators found. Add one above.
            </div>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'grid', gap: '0.5rem', paddingRight: '0.5rem' }}>
              {coordinators.map(c => {
                const isMe = c.email.toLowerCase() === currentUser?.email?.toLowerCase();
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--color-surface-secondary)', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'color-mix(in oklab, var(--color-surface-card) 85%, var(--color-text-primary) 15%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        {c.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 500, color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
                          {c.email}
                          {isMe && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: 'var(--color-border)', padding: '0.1rem 0.4rem', borderRadius: '1rem', color: 'var(--color-text-secondary)' }}>You</span>}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Added {new Date(c.addedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemove(c.id, c.email)}
                      className="dashboard-th-btn" 
                      style={{ color: '#fb7185', opacity: isMe ? 0.5 : 1, cursor: isMe ? 'not-allowed' : 'pointer' }}
                      disabled={actionLoading || isMe}
                      title={isMe ? "You cannot remove yourself" : "Remove coordinator"}
                    >
                      {actionLoading ? <Loader2 size={16} className="icon-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoordinatorManagerModal;
