const DashboardToast = ({ toast }) => {
  if (!toast) return null;

  return (
    <div className={`dashboard-toast ${toast.type === 'error' ? 'is-error' : ''}`}>
      {toast.message}
    </div>
  );
};

export default DashboardToast;
