import { format } from 'date-fns';
import { MapPin, Phone, Activity, Heart, Dog } from 'lucide-react';
import { motion } from 'framer-motion';

const OverviewTab = ({ shelter, manager, isCoordinator = true }) => {
  const statusColors = {
    open: { bg: '#059669', text: '#fff' },
    full: { bg: '#dc2626', text: '#fff' },
    closing: { bg: '#d97706', text: '#fff' },
    closed: { bg: '#64748b', text: '#fff' }
  };

  const containerVars = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVars = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const handleGetDirections = () => {
    // Open Google Maps to the coordinates
    const url = `https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lng}`;
    window.open(url, '_blank');
  };

  return (
    <motion.div 
      variants={containerVars} 
      initial="hidden" 
      animate="show" 
      style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', height: '100%' }}
    >
      
      {/* Lifecycle Status Segmented Control */}
      <motion.div variants={itemVars}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Activity size={14} color="#64748b" />
          <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Lifecycle Status
          </h3>
        </div>
        
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
          {['open', 'full', 'closing', 'closed'].map(status => {
            const isActive = shelter.status === status;
            return (
              <button
                key={status}
                onClick={() => isCoordinator && manager.updateStatus(shelter.id, status)}
                disabled={!isCoordinator}
                style={{
                  flex: 1,
                  padding: '0.5rem 0',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  border: 'none',
                  background: isActive ? statusColors[status].bg : 'transparent',
                  color: isActive ? statusColors[status].text : '#64748b',
                  boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  cursor: isCoordinator ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  opacity: (!isCoordinator && !isActive) ? 0.5 : 1
                }}
              >
                {status}
              </button>
            );
          })}
        </div>
        {shelter.status === 'full' && (
          <motion.p 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(220, 38, 38, 0.05)', borderRadius: '6px', borderLeft: '3px solid #dc2626' }}
          >
            <strong>Note:</strong> Civilians looking for shelter will be redirected to the nearest available site.
          </motion.p>
        )}
      </motion.div>

      {/* Details Grid */}
      <motion.div variants={itemVars} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        
        {/* Address Card */}
        <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ background: '#f1f5f9', padding: '0.4rem', borderRadius: '6px' }}>
              <MapPin size={14} color="#64748b" />
            </div>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 500, lineHeight: 1.4 }}>{shelter.address}</p>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{shelter.ward}, {shelter.district}</p>
          
          <button 
            onClick={handleGetDirections}
            style={{ marginTop: 'auto', paddingTop: '1rem', background: 'transparent', border: 'none', color: '#2d6148', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
          >
            Get Directions &rarr;
          </button>
        </div>

        {/* Contact Card */}
        <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ background: '#f1f5f9', padding: '0.4rem', borderRadius: '6px' }}>
              <Phone size={14} color="#64748b" />
            </div>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>{shelter.managerName || 'N/A'}</p>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{shelter.managerContact || 'N/A'}</p>
        </div>

      </motion.div>

      {/* Demographics */}
      <motion.div variants={itemVars}>
        <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
          Demographics Focus
        </h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          
          <div style={{ flex: 1, background: 'linear-gradient(145deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid rgba(59, 130, 246, 0.1)', padding: '1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: '#bfdbfe', padding: '0.6rem', borderRadius: '50%' }}>
              <Heart size={20} color="#1d4ed8" />
            </div>
            <div>
              <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e3a8a', lineHeight: 1 }}>{shelter.specialNeedsCount}</h4>
              <p style={{ fontSize: '0.65rem', color: '#2563eb', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginTop: '0.2rem' }}>Special Needs</p>
            </div>
          </div>
          
          <div style={{ flex: 1, background: shelter.petsAllowed ? 'linear-gradient(145deg, #ecfdf5 0%, #d1fae5 100%)' : '#f8fafc', border: shelter.petsAllowed ? '1px solid rgba(16, 185, 129, 0.1)' : '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: shelter.petsAllowed ? '#a7f3d0' : '#e2e8f0', padding: '0.6rem', borderRadius: '50%' }}>
              <Dog size={20} color={shelter.petsAllowed ? '#047857' : '#64748b'} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: shelter.petsAllowed ? '#064e3b' : '#475569', lineHeight: 1 }}>
                {shelter.petsAllowed ? shelter.petsCount : 'No'}
              </h4>
              <p style={{ fontSize: '0.65rem', color: shelter.petsAllowed ? '#059669' : '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginTop: '0.2rem' }}>
                Pets {shelter.petsAllowed ? 'Logged' : 'Allowed'}
              </p>
            </div>
          </div>

        </div>
      </motion.div>
      
      <motion.div variants={itemVars} style={{ marginTop: 'auto', paddingTop: '1rem' }}>
        <p style={{ fontSize: '0.65rem', color: '#94a3b8', textAlign: 'right', fontWeight: 500 }}>
          Activated: {format(new Date(shelter.createdAt), 'PPpp')}
        </p>
      </motion.div>

    </motion.div>
  );
};

export default OverviewTab;
