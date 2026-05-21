import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Logo from '../components/Logo';
import api from '../services/api';

/**
 * PostLoginRedirect — the single smart entry point after any auth.
 *
 * 1. Calls /api/auth/me which returns { role, isNewUser }
 * 2. Redirects to the correct workspace automatically based on the role.
 */
const PostLoginRedirect = () => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [phase, setPhase] = useState('loading'); // 'loading' | 'redirect'
  const [dbRole, setDbRole] = useState(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    const init = async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        localStorage.setItem('token', token);

        const res = await api.get('/auth/me');
        const data = res.data;

        localStorage.setItem('dbRole', data.role);
        localStorage.setItem(
          'currentUser',
          JSON.stringify({ id: data.id, name: data.name, email: data.email, role: data.role })
        );

        if (!cancelled) {
          // If volunteer, try to capture initial location immediately
          if (data.role === 'volunteer') {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                await api.patch('/volunteers/me/location', {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                }).catch(console.error);
              },
              console.error,
              { enableHighAccuracy: true }
            );
          }

          setDbRole(data.role);
          setPhase('redirect');
        }
      } catch (err) {
        console.error('PostLoginRedirect error:', err);
        if (!cancelled) setPhase('redirect'); // fallback
      }
    };

    init();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, getToken]);

  // ── Loading state ──────────────────────────────────────────
  if (!isLoaded || phase === 'loading') {
    return (
      <div className="page-loader">
        <div className="page-loader-inner">
          <Logo size={64} className="pulse" />
          <div className="page-loader-status">
            <Loader2 className="icon-spin" style={{ width: 16, height: 16 }} />
            <span className="page-loader-text">Setting up your workspace…</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Not signed in ──────────────────────────────────────────
  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  // ── Redirect to correct workspace ──────────────────────────
  if (dbRole === 'coordinator') return <Navigate to="/dashboard" replace />;
  if (dbRole === 'volunteer') return <Navigate to="/volunteer" replace />;
  // 'user', 'field_worker', or any other role → user dashboard
  return <Navigate to="/user-dashboard" replace />;
};

export default PostLoginRedirect;
