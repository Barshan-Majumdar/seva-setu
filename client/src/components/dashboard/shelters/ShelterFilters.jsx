import { Map, List, Filter, ChevronDown, Users, Activity, Check, Home, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo, useRef } from 'react';
import indiaData from '../../../data/indiaStatesDistricts.json';
import CustomSelect from '../../ui/CustomSelect';

const ShelterFilters = ({ filters, setFilters, allShelters, viewMode, setViewMode, setSelectedShelterId }) => {
  // Use a local "draft" state for filters until Apply is clicked
  const [draftFilters, setDraftFilters] = useState(filters);

  // Sync draft if external filters change
  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const allStates = useMemo(() => {
    return indiaData.states || [];
  }, []);

  const districtsForState = useMemo(() => {
    if (draftFilters.state === 'All') return [];
    return indiaData.districts[draftFilters.state] || [];
  }, [draftFilters.state]);

  const sheltersInRegion = useMemo(() => {
    let list = allShelters;
    if (draftFilters.state !== 'All') {
      list = list.filter(s => s.state === draftFilters.state);
    }
    if (draftFilters.district !== 'All') {
      list = list.filter(s => s.district === draftFilters.district);
    }
    return list.map(s => ({ value: s.id, label: s.name }));
  }, [allShelters, draftFilters.state, draftFilters.district]);

  const handleApply = () => {
    setFilters(draftFilters);
    // If a specific shelter was selected in the draft, also open its detail panel
    if (draftFilters.shelterId !== 'All') {
      setSelectedShelterId(draftFilters.shelterId);
    } else {
      setSelectedShelterId(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ 
        background: '#fff', 
        borderRadius: '16px', 
        padding: '1.25rem', 
        marginBottom: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        border: '1px solid rgba(0,0,0,0.05)',
        display: 'flex', 
        flexDirection: 'column',
        gap: '1.25rem' 
      }}
    >
      
      {/* Top Row: Filters */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', marginRight: '0.5rem', background: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
          <SlidersHorizontal size={14} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters</span>
        </div>

        <CustomSelect 
          value={draftFilters.state}
          onChange={(e) => setDraftFilters(prev => ({ ...prev, state: e.target.value, district: 'All', shelterId: 'All' }))}
          options={allStates}
          placeholder="All States"
          icon={<Map size={14} />}
        />

        <CustomSelect 
          value={draftFilters.district}
          onChange={(e) => setDraftFilters(prev => ({ ...prev, district: e.target.value, shelterId: 'All' }))}
          options={districtsForState}
          placeholder="All Districts"
          icon={<Map size={14} />}
          disabled={draftFilters.state === 'All'}
        />

        <CustomSelect 
          value={draftFilters.shelterId}
          onChange={(e) => setDraftFilters(prev => ({ ...prev, shelterId: e.target.value }))}
          options={sheltersInRegion}
          placeholder="All Shelters"
          icon={<Home size={14} />}
          disabled={draftFilters.district === 'All' && draftFilters.state === 'All'}
        />
      </div>

      <div style={{ height: '1px', background: '#e2e8f0', width: '100%' }} />

      {/* Bottom Row: Additional Filters & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          <CustomSelect 
            value={draftFilters.status}
            onChange={(e) => setDraftFilters(prev => ({ ...prev, status: e.target.value }))}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'full', label: 'Full' },
              { value: 'closing', label: 'Closing' },
              { value: 'closed', label: 'Closed' }
            ]}
            placeholder="All Statuses"
            icon={<Activity size={14} />}
          />

          <div style={{ position: 'relative', width: '180px' }}>
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <Users size={14} />
            </div>
            <input 
              type="number"
              min="0"
              placeholder="Min Capacity..."
              value={draftFilters.minCapacity || ''}
              onChange={(e) => setDraftFilters(prev => ({ ...prev, minCapacity: e.target.value }))}
              style={{
                width: '100%',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.6rem 1rem 0.6rem 2.2rem',
                fontSize: '0.8rem',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Apply Button */}
          <motion.button
            whileHover={{ scale: 1.02, backgroundColor: '#1e4b35' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleApply}
            style={{
              padding: '0.6rem 1.5rem',
              background: '#2d6148',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(45, 97, 72, 0.2)'
            }}
          >
            <Check size={16} /> Apply Filters
          </motion.button>

          <div style={{ width: '1px', height: '24px', background: '#cbd5e1' }} />

          {/* View Toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.35rem', borderRadius: '10px' }}>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              style={{ 
                padding: '0.5rem 1rem', 
                background: viewMode === 'map' ? '#fff' : 'transparent',
                boxShadow: viewMode === 'map' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                borderRadius: '8px',
                border: 'none',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                color: viewMode === 'map' ? '#0f172a' : '#64748b',
                fontWeight: viewMode === 'map' ? 600 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setViewMode('map')}
            >
              <Map size={14} color={viewMode === 'map' ? '#2d6148' : '#94a3b8'} /> Map View
            </motion.button>
            
            <motion.button 
              whileTap={{ scale: 0.95 }}
              style={{ 
                padding: '0.5rem 1rem', 
                background: viewMode === 'list' ? '#fff' : 'transparent',
                boxShadow: viewMode === 'list' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                borderRadius: '8px',
                border: 'none',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                color: viewMode === 'list' ? '#0f172a' : '#64748b',
                fontWeight: viewMode === 'list' ? 600 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setViewMode('list')}
            >
              <List size={14} color={viewMode === 'list' ? '#2d6148' : '#94a3b8'} /> Directory
            </motion.button>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default ShelterFilters;
