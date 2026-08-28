import { useState } from 'react';
import { UserMinus, ShieldCheck } from 'lucide-react';

const StaffingTab = ({ shelter, manager }) => {
  const isCoordinator = true;
  const [selectedVolunteer, setSelectedVolunteer] = useState('');
  const [role, setRole] = useState('');

  // Volunteers available for assignment (not already assigned here)
  const availableVolunteers = manager.availableVolunteers.filter(
    v => !shelter.staffing.some(s => s.volunteerId === v.id)
  );

  const handleAssign = (e) => {
    e.preventDefault();
    if (selectedVolunteer && role) {
      manager.assignVolunteer(shelter.id, selectedVolunteer, role);
      setSelectedVolunteer('');
      setRole('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Shelter Roster</h3>
      </div>

      {isCoordinator && shelter.status !== 'closed' && (
        <form onSubmit={handleAssign} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Volunteer</label>
            <select 
              required
              value={selectedVolunteer}
              onChange={e => setSelectedVolunteer(e.target.value)}
              style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            >
              <option value="">Select Volunteer...</option>
              {availableVolunteers.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.skills.join(', ')})</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Role/Shift</label>
            <input 
              required
              type="text"
              placeholder="e.g. Medical Lead"
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
          </div>
          <button type="submit" className="dashboard-dispatch-btn-premium primary" style={{ padding: '0.4rem 1rem', height: '34px' }}>
            Assign
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {shelter.staffing.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', background: '#f8fafc', borderRadius: '8px' }}>
            No volunteers assigned to this shelter yet.
          </div>
        ) : (
          shelter.staffing.map(assignment => {
            const volunteer = manager.availableVolunteers.find(v => v.id === assignment.volunteerId);
            if (!volunteer) return null;

            return (
              <div key={assignment.volunteerId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{volunteer.name}</p>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{assignment.role}</p>
                  </div>
                </div>

                {isCoordinator && (
                  <button 
                    onClick={() => manager.unassignVolunteer(shelter.id, volunteer.id)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Unassign Volunteer"
                  >
                    <UserMinus size={18} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default StaffingTab;
