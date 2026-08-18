import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';

/**
 * ShelterSelectionTray
 * --------------------
 * Fixed-position floating bar at the bottom of viewport.
 * Only visible when ≥1 shelter selected, animated in/out with framer-motion.
 * Max-10 warning renders INLINE in the tray (not as a separate Toast)
 * to avoid z-index collision with Toast.jsx (fixed bottom-8 z-[999999]).
 *
 * Receives all state via props (no context).
 */
const ShelterSelectionTray = ({
  selectedIds,
  shelters,
  toggleSelect,
  clearSelection,
  openCompare,
  isMaxed,
  maxWarning,
}) => {
  const MAX_VISIBLE_CHIPS = 6;
  const selectedShelters = shelters.filter((s) => selectedIds.includes(s.id));
  const visibleChips = selectedShelters.slice(0, MAX_VISIBLE_CHIPS);
  const overflowCount = selectedShelters.length - MAX_VISIBLE_CHIPS;

  return (
    <AnimatePresence>
      {selectedIds.length > 0 && (
        <motion.div
          className="shelter-selection-tray"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60, transition: { duration: 0.15 } }}
          transition={{
            type: 'spring',
            damping: 25,
            stiffness: 400,
            mass: 0.8,
          }}
        >
          {/* Left: Chips + counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', overflow: 'hidden' }}>
              {visibleChips.map((shelter) => (
                <span key={shelter.id} className="shelter-chip">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                    {shelter.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(shelter.id);
                    }}
                    title={`Remove ${shelter.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {overflowCount > 0 && (
                <span className="shelter-chip" style={{ background: 'rgba(45, 97, 72, 0.08)', color: '#2d6148', border: '1px solid rgba(45, 97, 72, 0.15)' }}>
                  +{overflowCount} more
                </span>
              )}
            </div>

            <span style={{
              fontSize: '0.7rem', fontWeight: 700, color: '#64748b',
              whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
              marginLeft: '0.5rem',
            }}>
              {selectedIds.length} / 10 selected
            </span>

            {/* Inline max-10 warning */}
            <AnimatePresence>
              {maxWarning && (
                <motion.span
                  className="shelter-tray-warning"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <AlertCircle size={12} />
                  Max 10 — remove one to add another
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={clearSelection}
              style={{
                fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8',
                background: 'transparent', border: 'none', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >
              Clear all
            </button>
            <button
              type="button"
              className="dashboard-dispatch-btn-premium primary"
              onClick={openCompare}
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
            >
              Compare Selected ({selectedIds.length})
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShelterSelectionTray;
