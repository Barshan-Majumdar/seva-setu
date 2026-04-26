import { Navigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/react';
import { Loader2 } from 'lucide-react';
import Logo from './Logo';

/**
 * ProtectedRoute — gate that waits for Clerk to finish loading
 * before deciding whether to render children or redirect to /login.
 *
 * Optional `requiredRole` prop enforces role-based access.
 * If the user's DB role doesn't match, they're redirected to their correct workspace.
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isSignedIn, isLoaded } = useClerkAuth();

  // Clerk hasn't finished loading yet → show a spinner, NOT a redirect
  if (!isLoaded) {
    return (
      <div className="page-loader">
        <div className="page-loader-inner">
          <Logo size={64} className="pulse" />
          <div className="page-loader-status">
            <Loader2 className="icon-spin" style={{ width: 16, height: 16 }} />
            <span className="page-loader-text">Authenticating</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  // Role-based guard
  if (requiredRole) {
    const dbRole = localStorage.getItem('dbRole');
    if (dbRole && dbRole !== requiredRole) {
      // Redirect to their correct workspace based on actual role
      if (dbRole === 'coordinator') return <Navigate to="/dashboard" replace />;
      if (dbRole === 'volunteer') return <Navigate to="/volunteer" replace />;
      if (dbRole === 'user') return <Navigate to="/user-dashboard" replace />;
      // field_worker or unknown → user dashboard
      return <Navigate to="/user-dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
