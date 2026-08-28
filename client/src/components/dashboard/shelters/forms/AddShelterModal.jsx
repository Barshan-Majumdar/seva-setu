import { useState, useMemo } from 'react';
import { X, Building, MapPin, Users, HeartPulse, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import indiaData from '../../../../data/indiaStatesDistricts.json';
import CustomSelect from '../../../ui/CustomSelect';

const AddShelterModal = ({ manager, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    state: '',
    district: '',
    ward: '',
    address: '',
    capacityTotal: 100,
    specialNeedsCount: 0,
    managerName: '',
    managerContact: '',
    petsAllowed: false,
    medicalSupport: false,
    wheelchairAccessible: false,
    childCare: false,
    lat: 28.6139, // defaults
    lng: 77.2090
  });

  const allStates = useMemo(() => indiaData.states || [], []);
  const districtsForState = useMemo(() => {
    if (!formData.state) return [];
    return indiaData.districts[formData.state] || [];
  }, [formData.state]);

  const handleSubmit = (e) => {
    e.preventDefault();
    manager.activateShelter({
      ...formData,
      capacityTotal: parseInt(formData.capacityTotal, 10) || 0,
      specialNeedsCount: parseInt(formData.specialNeedsCount, 10) || 0,
      petsCount: 0,
      facilities: [
        ...(formData.medicalSupport ? ['Medical'] : []),
        ...(formData.wheelchairAccessible ? ['Wheelchair'] : []),
        ...(formData.childCare ? ['Childcare'] : [])
      ]
    });
    onClose();
  };

  const inputStyle = {
    width: '100%',
    padding: '0.65rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.85rem',
    outline: 'none',
    transition: 'all 0.2s ease',
    background: '#f8fafc',
    color: '#0f172a'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#475569',
    marginBottom: '0.35rem',
    textTransform: 'uppercase',
    letterSpacing: '0.02em'
  };

  return (
    <div className="dashboard-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="dashboard-modal card" 
        style={{ width: 'min(750px, 100vw)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
      >
        <div style={{ position: 'sticky', top: 0, background: '#fff', padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#ecfdf5', padding: '0.5rem', borderRadius: '10px', color: '#059669' }}>
              <Building size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Activate New Shelter</h2>
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Register a new facility to receive allocations.</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', color: '#64748b', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'} onMouseOut={e => e.currentTarget.style.background = '#f1f5f9'}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            
            {/* Section 1: Location & Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <MapPin size={16} color="#3b82f6" />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Location Details</h3>
              </div>

              <div>
                <label style={labelStyle}>Shelter Name</label>
                <input required type="text" placeholder="e.g. Community Hall" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>State</label>
                  <CustomSelect
                    value={formData.state}
                    onChange={e => setFormData({ ...formData, state: e.target.value, district: '' })}
                    options={allStates}
                    placeholder="Select State"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>District</label>
                  <CustomSelect
                    disabled={!formData.state}
                    value={formData.district}
                    onChange={e => setFormData({ ...formData, district: e.target.value })}
                    options={districtsForState}
                    placeholder="Select District"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Ward / Locality</label>
                <input required type="text" placeholder="e.g. Ward No. 12" value={formData.ward} onChange={e => setFormData({ ...formData, ward: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              
              <div>
                <label style={labelStyle}>Full Address</label>
                <textarea required placeholder="Complete street address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>

            {/* Section 2: Capacity & Contact */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <Users size={16} color="#d97706" />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Capacity & Contact</h3>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Total Capacity</label>
                  <input required type="number" min="1" value={formData.capacityTotal} onChange={e => setFormData({ ...formData, capacityTotal: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Special Needs Capacity</label>
                  <input required type="number" min="0" value={formData.specialNeedsCount} onChange={e => setFormData({ ...formData, specialNeedsCount: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Manager Name</label>
                  <input type="text" placeholder="Coordinator Name" value={formData.managerName} onChange={e => setFormData({ ...formData, managerName: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Contact No.</label>
                  <input type="text" placeholder="+91" value={formData.managerContact} onChange={e => setFormData({ ...formData, managerContact: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginTop: '0.5rem' }}>
                <HeartPulse size={16} color="#dc2626" />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Facilities & Services</h3>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { id: 'petsAllowed', label: 'Pets Allowed' },
                  { id: 'medicalSupport', label: 'Medical Support' },
                  { id: 'wheelchairAccessible', label: 'Wheelchair Accessible' },
                  { id: 'childCare', label: 'Child Care Area' }
                ].map(item => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 500, color: '#334155', cursor: 'pointer', background: formData[item.id] ? '#f0fdf4' : 'transparent', border: `1px solid ${formData[item.id] ? '#86efac' : '#e2e8f0'}`, padding: '0.5rem', borderRadius: '8px', transition: 'all 0.2s ease' }}>
                    <input type="checkbox" checked={formData[item.id]} onChange={e => setFormData({ ...formData, [item.id]: e.target.checked })} style={{ accentColor: '#059669', width: '16px', height: '16px', cursor: 'pointer' }} />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ padding: '0.65rem 2rem', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)' }}>
              <CheckCircle2 size={16} /> Activate Facility
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AddShelterModal;
