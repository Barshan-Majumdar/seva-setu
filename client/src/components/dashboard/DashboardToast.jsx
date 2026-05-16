import Toast from '../Toast';
import { AnimatePresence } from 'framer-motion';

const DashboardToast = ({ toast, onClose }) => {
  return (
    <AnimatePresence>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
};

export default DashboardToast;
