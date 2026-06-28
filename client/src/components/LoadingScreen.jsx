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
    hidden: { opacity: 1 },
    visible: { opacity: 1, transition: { duration: 0.8, ease: "easeOut" } },
    exit: { opacity: 0, scale: 1.05, filter: 'blur(12px)', transition: { duration: 0.8, ease: "easeInOut" } }
  };

  const fillVariants = {
    hiddenH: { width: "0%" },
    visibleH: { width: "100%", transition: { duration: 1.8, ease: "easeInOut" } },
    hiddenV: { height: "0%" },
    visibleV: { height: "100%", transition: { duration: 1.8, ease: "easeInOut" } }
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
            <div style={{ display: 'flex' }}>
              <span className="ls-brand-seva">Seva</span>
              <span className="ls-brand-setu">Setu</span>
            </div>
          </div>

          <div className="ls-content">
            <div className="ls-tracker">
              
              {/* Node 1: User Need */}
              <div className={`ls-node-wrapper ${getNodeState(0)}`}>
                <div className="ls-icon-transparent">
                  {/* Stage 0 immediately starts pulsing */}
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
                  initial={window.innerWidth > 768 ? "hiddenH" : "hiddenV"}
                  animate={stage >= 0 ? (window.innerWidth > 768 ? "visibleH" : "visibleV") : (window.innerWidth > 768 ? "hiddenH" : "hiddenV")}
                />
              </div>

              {/* Node 2: Bridge */}
              <div className={`ls-node-wrapper ${getNodeState(1)}`}>
                <div className="ls-icon-transparent">
                  {/* Starts spinning exactly when Connector 1 finishes (stage 1) */}
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
                  initial={window.innerWidth > 768 ? "hiddenH" : "hiddenV"}
                  animate={stage >= 1 ? (window.innerWidth > 768 ? "visibleH" : "visibleV") : (window.innerWidth > 768 ? "hiddenH" : "hiddenV")}
                />
              </div>

              {/* Node 3: Relief */}
              <div className={`ls-node-wrapper ${getNodeState(2)}`}>
                <div className="ls-icon-transparent">
                  {/* Starts bouncing exactly when Connector 2 finishes (stage 2) */}
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
