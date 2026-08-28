import { Building2, Users, AlertTriangle, Home } from 'lucide-react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

const ShelterSummaryStrip = ({ manager }) => {
  const summary = manager.getSummary();

  const cards = [
    {
      id: 'active',
      icon: Building2,
      label: 'Active Shelters',
      value: summary.totalShelters,
      trend: 'Operating now',
      color: '#2d6148',
      bgBase: '45, 97, 72'
    },
    {
      id: 'capacity',
      icon: Home,
      label: 'Total Capacity',
      value: summary.totalCapacity,
      trend: 'Max persons',
      color: '#3b82f6',
      bgBase: '59, 130, 246'
    },
    {
      id: 'occupancy',
      icon: Users,
      label: 'Current Occupancy',
      value: summary.totalOccupancy,
      trend: `${summary.totalCapacity > 0 ? Math.round((summary.totalOccupancy / summary.totalCapacity) * 100) : 0}% Full`,
      color: '#d97706',
      bgBase: '217, 119, 6'
    },
    {
      id: 'critical',
      icon: AlertTriangle,
      label: 'Critical Alerts',
      value: summary.criticalShelters,
      trend: 'Shelters Overcrowded or Low Stock',
      color: '#dc2626',
      bgBase: '220, 38, 38',
      isAlert: summary.criticalShelters > 0
    }
  ];

  return (
    <motion.div 
      className="dashboard-summary-grid"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      style={{ marginBottom: '1.5rem' }}
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.id}
          variants={itemVariants}
          whileHover={{ y: -4, scale: 1.02, boxShadow: '0 12px 24px rgba(0,0,0,0.08)' }}
          className="dashboard-summary-card"
          style={{ 
            borderColor: card.isAlert ? `rgba(${card.bgBase}, 0.3)` : undefined,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem', // reduced from 1rem
            padding: '1rem' // reduced from 1.25rem
          }}
        >
          {/* Animated background flair */}
          <motion.div 
            style={{ 
              position: 'absolute', 
              top: '-50%', 
              right: '-20%', 
              width: '120px', 
              height: '120px', 
              background: `radial-gradient(circle, rgba(${card.bgBase},0.15) 0%, rgba(${card.bgBase},0) 70%)`,
              borderRadius: '50%',
              zIndex: 0
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              repeatType: "reverse",
              delay: i * 0.5
            }}
          />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="dashboard-summary-icon" style={{ background: `rgba(${card.bgBase}, 0.1)`, color: card.color, padding: '0.5rem', borderRadius: '10px' }}>
              <card.icon size={18} strokeWidth={2.5} />
            </div>
            
            {/* Optional sparkling badge for alerts */}
            {card.isAlert && (
              <motion.span 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: 0.6 }}
                style={{
                  background: card.color,
                  color: 'white',
                  fontSize: '0.6rem',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '12px',
                  textTransform: 'uppercase'
                }}
              >
                Action Req
              </motion.span>
            )}
          </div>
          
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <p className="dashboard-summary-label" style={{ color: card.isAlert ? card.color : undefined, fontSize: '0.7rem' }}>
              {card.label}
            </p>
            <h3 className="dashboard-summary-value" style={{ color: card.isAlert ? card.color : undefined, fontSize: '1.75rem', margin: 0 }}>
              {card.value}
            </h3>
            <p style={{ 
              fontSize: '0.7rem', 
              color: card.isAlert ? card.color : '#64748b', 
              fontWeight: 500,
              marginTop: '0.15rem'
            }}>
              {card.trend}
            </p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default ShelterSummaryStrip;
