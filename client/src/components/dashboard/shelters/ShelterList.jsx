import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Map, Users as UsersIcon, Bell, MapPin, Users, AlertCircle, Activity, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ShelterList = ({ shelters, selectedShelterId, setSelectedShelterId }) => {
  const [sortKey, setSortKey] = useState('occupancyPercent');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedShelters = [...shelters].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === 'criticality') {
      valA = (a.isOvercrowded ? 10 : 0) + a.criticalResources.length;
      valB = (b.isOvercrowded ? 10 : 0) + b.criticalResources.length;
    } else if (sortKey === 'name' || sortKey === 'district') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return '#059669'; // Emerald
      case 'full': return '#dc2626'; // Red
      case 'closing': return '#d97706'; // Amber
      case 'closed': return '#64748b'; // Slate
      default: return '#64748b';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  const SortButton = ({ columnKey, label, flex, Icon }) => {
    const isActive = sortKey === columnKey;
    return (
      <div style={{ flex }}>
        <motion.button
          onClick={() => handleSort(columnKey)}
          whileHover={{ backgroundColor: isActive ? '#e2e8f0' : '#f1f5f9', scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            cursor: 'pointer',
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            background: isActive ? '#f1f5f9' : 'transparent',
            border: 'none',
            color: isActive ? '#0f172a' : '#64748b',
            transition: 'color 0.2s'
          }}
        >
          <Icon size={14} color={isActive ? '#3b82f6' : '#94a3b8'} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', width: '14px', opacity: isActive ? 1 : 0.3 }}>
            {isActive && sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </motion.button>
      </div>
    );
  };

  return (
    <div className="dashboard-card" style={{ padding: '0', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: 'min(800px, 85vh)' }}>
      
      {/* Premium Header / Sorting Bar */}
      <div className="flex gap-4 items-center sticky top-0 z-10 px-4 sm:px-6 py-3 bg-white border-b border-slate-200 overflow-x-auto whitespace-nowrap">
        <SortButton columnKey="name" label="Shelter / Location" flex="2" Icon={Map} />
        <SortButton columnKey="occupancyPercent" label="Occupancy" flex="1.5" Icon={UsersIcon} />
        <div style={{ flex: '1.5', display: 'flex', justifyContent: 'flex-end' }}>
          <SortButton columnKey="criticality" label="Status & Alerts" flex="none" Icon={Bell} />
        </div>
      </div>

      {/* List Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        <AnimatePresence>
          {sortedShelters.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <Activity size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>No shelters match the selected filters.</p>
            </motion.div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sortedShelters.map(shelter => {
                const isSelected = selectedShelterId === shelter.id;
                const statusColor = getStatusColor(shelter.status);
                
                return (
                  <motion.div 
                    variants={itemVariants}
                    key={shelter.id}
                    onClick={() => setSelectedShelterId(shelter.id)}
                    className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center relative overflow-hidden transition-all duration-200"
                    style={{
                      background: '#fff',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #2d6148' : '1px solid #e2e8f0',
                      boxShadow: isSelected ? '0 4px 12px rgba(45, 97, 72, 0.1)' : '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                    whileHover={{ y: -2, boxShadow: '0 8px 16px rgba(0,0,0,0.04)', borderColor: '#cbd5e1' }}
                  >
                    {/* Status Indicator Bar */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: statusColor }} />
                    
                    {/* Column 1: Identity & Location */}
                    <div className="w-full sm:flex-[2] min-w-0 flex flex-col gap-1.5">
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shelter.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <MapPin size={12} /> {shelter.ward}, {shelter.district}
                        </span>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          textTransform: 'uppercase', 
                          color: statusColor,
                          background: `${statusColor}15`,
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {shelter.status}
                        </span>
                      </div>
                    </div>

                    {/* Column 2: Occupancy Mini-Dashboard */}
                    <div className="w-full sm:flex-[1.5] flex flex-col gap-1.5 pr-6 sm:pr-0">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: shelter.isOvercrowded ? '#dc2626' : '#0f172a' }}>
                          {shelter.occupancyPercent}%
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                          {shelter.occupancyCurrent} / {shelter.capacityTotal} <Users size={10} style={{ display: 'inline', marginLeft: '2px' }}/>
                        </span>
                      </div>
                      <div style={{ height: '6px', width: '100%', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(shelter.occupancyPercent, 100)}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          style={{ 
                            height: '100%', 
                            background: shelter.isOvercrowded ? '#dc2626' : shelter.occupancyPercent > 70 ? '#d97706' : '#059669',
                            borderRadius: '3px'
                          }} 
                        />
                      </div>
                    </div>

                    {/* Column 3: Alerts & Badges */}
                    <div className="w-full sm:flex-[1.5] flex justify-start sm:justify-end gap-1.5 flex-wrap pr-6 sm:pr-0">
                      {shelter.hasCriticalResource && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.5rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px' }}>
                          <AlertCircle size={10} /> LOW STOCK
                        </span>
                      )}
                      {shelter.isOvercrowded && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.5rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px' }}>
                          <AlertCircle size={10} /> FULL
                        </span>
                      )}
                      {shelter.openIncidentsCount > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.5rem', background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px' }}>
                          <AlertCircle size={10} /> {shelter.openIncidentsCount} ALERTS
                        </span>
                      )}
                      {!shelter.hasCriticalResource && !shelter.isOvercrowded && shelter.openIncidentsCount === 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.5rem', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', fontSize: '0.65rem', fontWeight: 700, borderRadius: '6px' }}>
                          OK
                        </span>
                      )}
                    </div>
                    
                    {/* Selected Chevron indicator */}
                    <div style={{ position: 'absolute', right: '0.5rem', opacity: isSelected ? 1 : 0, transition: 'opacity 0.2s', color: '#2d6148' }}>
                      <ChevronRight size={16} />
                    </div>

                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ShelterList;
