import { useState } from 'react';
import { X, UserCheck, Loader2, Send, FileText, Phone, User } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

const VolunteerApplicationModal = ({ onClose, onSubmitted }) => {
  const { currentUser } = useAuth();
  const [form, setForm] = useState({
    full_name: currentUser?.name || '',
    contact_details: currentUser?.email || '',
    proof_of_work: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim() || !form.contact_details.trim() || !form.proof_of_work.trim()) {
      setError('All fields are required.');
      return;
    }

    if (form.proof_of_work.trim().length < 30) {
      setError('Please provide a more detailed description of your capabilities (at least 30 characters).');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/volunteer-requests', form);
      onSubmitted();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose}>
      <div
        className="dashboard-modal card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px' }}
      >
        {/* Header */}
        <div className="dashboard-modal-header" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'rgba(45, 97, 72, 0.06)', border: '1px solid rgba(45, 97, 72, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserCheck className="w-5 h-5" style={{ color: '#2d6148' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Volunteer Application</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                Tell us about yourself and your capabilities
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(15, 23, 29, 0.04)', border: '1px solid rgba(15, 23, 29, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--color-text-muted)',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Full Name */}
          <div>
            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <User className="w-3 h-3" />
              Full Name
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Enter your full name"
              value={form.full_name}
              onChange={(e) => setForm(prev => ({ ...prev, full_name: e.target.value }))}
            />
          </div>

          {/* Contact Details */}
          <div>
            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Phone className="w-3 h-3" />
              Contact Details
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Phone number or email"
              value={form.contact_details}
              onChange={(e) => setForm(prev => ({ ...prev, contact_details: e.target.value }))}
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
              Provide a phone number or email where coordinators can reach you.
            </p>
          </div>

          {/* Proof of Work / Capability */}
          <div>
            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText className="w-3 h-3" />
              Proof of Work / Capability
            </label>
            <textarea
              className="input-field"
              rows={5}
              placeholder="Describe your experience, skills, and what you can contribute as a volunteer. Include any relevant certifications, past volunteer work, or community service experience..."
              value={form.proof_of_work}
              onChange={(e) => setForm(prev => ({ ...prev, proof_of_work: e.target.value }))}
              style={{ resize: 'vertical', minHeight: '120px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                This will be reviewed by a coordinator before approval.
              </p>
              <span style={{
                fontSize: '0.65rem', fontFamily: 'monospace',
                color: form.proof_of_work.length >= 30 ? '#059669' : 'var(--color-text-muted)',
              }}>
                {form.proof_of_work.length}/30 min
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '10px',
              background: 'rgba(195, 93, 81, 0.06)', border: '1px solid rgba(195, 93, 81, 0.15)',
              color: '#c35d51', fontSize: '0.85rem', fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <div style={{ marginTop: '0.5rem', paddingBottom: '0.5rem' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                minHeight: '52px',
                backgroundColor: '#2d6148',
                color: '#ffffff',
                borderRadius: '12px',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(45, 97, 72, 0.2)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                transition: 'all 0.2s ease'
              }}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {submitting ? 'Submitting Application...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VolunteerApplicationModal;
