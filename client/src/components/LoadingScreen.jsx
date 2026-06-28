import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Link as LinkIcon, HeartHandshake } from 'lucide-react';
import '../styles/loading-screen.css';
import Logo from './Logo';

const LoadingScreen = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Timings optimized for a smooth, premium feel
    const timer1 = setTimeout(() => setStage(1), 1800); // Need -> Bridge
    const timer2 = setTimeout(() => setStage(2), 3600); // Bridge -> Relief
    const timer3 = setTimeout(() => {
      setStage(3); // Fade out start
      if (onComplete) {
        setTimeout(onComplete, 600);
      }
    }, 5400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  // Framer Motion Configurations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.6 } },
    exit: { opacity: 0, scale: 1.05, filter: 'blur(10px)', transition: { duration: 0.6, ease: 'easeInOut' } }
  };

  const fillVariants = {
    hidden: { scaleX: 0, scaleY: 0 },
    visibleH: { scaleX: 1, transition: { duration: 1.2, ease: "easeInOut" } },
    visibleV: { scaleY: 1, transition: { duration: 1.2, ease: "easeInOut" } }
  };

  // Determine node states
  const getNodeState = (nodeIndex) => {
    if (stage === nodeIndex) return 'active';
    if (stage > nodeIndex) return 'completed';
    return '';
  };

  return (
    <AnimatePresence>
      {stage < 3 && (
        <motion.div 
          className="ls-wrapper"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="ls-bg-glow"></div>

          <div className="ls-brand">
            <Logo size={32} className="ls-brand-logo" />
            <span className="ls-brand-seva">Seva</span><span className="ls-brand-setu">Setu</span>
          </div>

          <div className="ls-content">
            <div className="ls-tracker">
              
              {/* Node 1: User Need */}
              <div className={`ls-node-wrapper ${getNodeState(0)}`}>
                <div className="ls-icon-transparent">
                  {/* Keep animation running if stage >= 0 */}
                  <Search size={40} className={stage >= 0 ? "icon-pulse" : ""} />
                </div>
                <div className="ls-text">
                  <h3>Identify Need</h3>
                  <p>Analyzing situation</p>
                </div>
              </div>

              {/* Connector 1 */}
              <div className="ls-connector">
                <motion.div 
                  className="ls-connector-fill"
                  variants={fillVariants}
                  initial="hidden"
                  animate={stage >= 1 ? (window.innerWidth > 768 ? "visibleH" : "visibleV") : "hidden"}
                  style={{ originX: 0, originY: 0 }}
                />
                {stage === 0 && <div className="ls-connector-light" />}
              </div>

              {/* Node 2: Bridge */}
              <div className={`ls-node-wrapper ${getNodeState(1)}`}>
                <div className="ls-icon-transparent">
                  {/* Keep animation running if stage >= 1 */}
                  <LinkIcon size={40} className={stage >= 1 ? "icon-spin" : ""} />
                </div>
                <div className="ls-text">
                  <h3>Building Bridge</h3>
                  <p>Connecting volunteers</p>
                </div>
              </div>

              {/* Connector 2 */}
              <div className="ls-connector">
                <motion.div 
                  className="ls-connector-fill"
                  variants={fillVariants}
                  initial="hidden"
                  animate={stage >= 2 ? (window.innerWidth > 768 ? "visibleH" : "visibleV") : "hidden"}
                  style={{ originX: 0, originY: 0 }}
                />
                {stage === 1 && <div className="ls-connector-light" />}
              </div>

              {/* Node 3: Relief */}
              <div className={`ls-node-wrapper ${getNodeState(2)}`}>
                <div className="ls-icon-transparent">
                  {/* Keep animation running if stage >= 2 */}
                  <HeartHandshake size={40} className={stage >= 2 ? "icon-bounce" : ""} />
                </div>
                <div className="ls-text">
                  <h3>Immediate Relief</h3>
                  <p>Support dispatched</p>
                </div>
              </div>

            </div>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;
