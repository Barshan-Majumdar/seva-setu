import { useState } from 'react';
import { X } from 'lucide-react';

export default function ServerMaintenanceAlert() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-accent-moss-dark to-accent-moss text-white px-6 py-3 relative z-50 w-full flex items-center justify-center">
      <div className="w-full flex items-center justify-center relative">
        <p className="m-0 text-l font-medium text-center px-10">
          <strong>Alert:</strong> Scheduled server maintenance will begin on May 27th. The website may experience temporary downtime.
        </p>
        <button 
          onClick={() => setIsVisible(false)}
          aria-label="Dismiss alert"
          className="absolute right-0 bg-transparent border-none text-white cursor-pointer p-1.5 flex items-center justify-center rounded-full flex-shrink-0 hover:bg-white/20 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
