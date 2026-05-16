import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X, Sparkles, Loader2 } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    mission: <Sparkles className="w-5 h-5 text-amber-500" />
  };

  const bgStyles = {
    success: 'bg-white/90 border-emerald-500/20 shadow-emerald-500/10',
    error: 'bg-white/90 border-rose-500/20 shadow-rose-500/10',
    info: 'bg-white/90 border-blue-500/20 shadow-blue-500/10',
    mission: 'bg-white/90 border-amber-500/20 shadow-amber-500/10'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      transition={{ 
        type: 'spring',
        damping: 25,
        stiffness: 400,
        mass: 0.8
      }}
      className={`fixed bottom-8 left-0 right-0 mx-auto w-fit z-[999999] min-w-[240px] max-w-[92vw] p-1 rounded-2xl border backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] ${bgStyles[type]}`}
    >
      <div className="flex items-center gap-2.5 p-2">
        <div className={`p-1.5 rounded-xl bg-surface-secondary shadow-inner`}>
          {icons[type] || icons.info}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text-primary leading-tight">
            {message}
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors text-text-muted hover:text-text-primary"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <motion.div 
        initial={{ width: '100%' }}
        animate={{ width: 0 }}
        transition={{ duration: 4.8, ease: 'linear' }}
        className={`h-1 rounded-full absolute bottom-0 left-0 ${
          type === 'success' ? 'bg-emerald-500' : 
          type === 'error' ? 'bg-rose-500' : 
          type === 'info' ? 'bg-blue-500' : 'bg-amber-500'
        } opacity-30`}
      />
    </motion.div>
  );
};

export default Toast;
