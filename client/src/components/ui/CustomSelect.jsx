import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CustomSelect = ({ value, onChange, options, icon, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedLabel = value === 'All' || !value ? placeholder : (options.find(o => (o.value || o) === value)?.label || value);

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: 0, opacity: disabled ? 0.5 : 1 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: disabled ? '#f1f5f9' : (isOpen ? '#fff' : '#f8fafc'),
          border: `1px solid ${isOpen ? '#3b82f6' : '#e2e8f0'}`,
          borderRadius: '8px',
          padding: '0.6rem 1rem',
          fontSize: '0.8rem',
          fontWeight: 500,
          color: value && value !== 'All' ? '#0f172a' : '#64748b',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
          boxShadow: isOpen && !disabled ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
        }}
        onMouseOver={(e) => { if(!disabled && !isOpen) e.currentTarget.style.borderColor = '#cbd5e1'; }}
        onMouseOut={(e) => { if(!disabled && !isOpen) e.currentTarget.style.borderColor = '#e2e8f0'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
          {icon && <span style={{ color: '#94a3b8', display: 'flex' }}>{icon}</span>}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedLabel}</span>
        </div>
        <ChevronDown size={14} style={{ color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              width: '100%',
              maxHeight: '220px',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: '10px',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.05)',
              zIndex: 1050, // Higher than modal z-index which is 1000
              padding: '0.35rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            <div
              onClick={() => { onChange({ target: { value: '' }}); setIsOpen(false); }}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: (!value || value === 'All') ? 600 : 500,
                color: (!value || value === 'All') ? '#2d6148' : '#334155',
                background: (!value || value === 'All') ? '#f0fdf4' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseOver={e => { if(value && value !== 'All') e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseOut={e => { if(value && value !== 'All') e.currentTarget.style.background = 'transparent'; }}
            >
              {placeholder}
            </div>
            {options.map(opt => {
              const optValue = opt.value || opt;
              const optLabel = opt.label || opt;
              const isSelected = value === optValue;
              
              return (
                <div
                  key={optValue}
                  onClick={() => { onChange({ target: { value: optValue }}); setIsOpen(false); }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 600 : 500,
                    color: isSelected ? '#2d6148' : '#334155',
                    background: isSelected ? '#f0fdf4' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseOver={e => { if(!isSelected) e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseOut={e => { if(!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  {optLabel}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomSelect;
