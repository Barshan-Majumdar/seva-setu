import { useEffect, useRef } from 'react';
import { useAuth as useClerkAuth } from '@clerk/react';

import api from '../services/api';

/**
 * RoleSync — invisible component that runs once on mount.
 *
 * Blocks the UI (via onReady callback) until the backend identity
 * is verified, preventing role-flash where the wrong dashboard
 * is briefly shown before the correct role loads from the server.
 */
const RoleSync = ({ onReady }) => {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    // If not signed in, we're done — let the app show the landing/login page
    if (!isSignedIn) {
      onReady();
      return;
    }

    // Already synced (StrictMode double-fire guard)
    if (hasSynced.current) return;
    hasSynced.current = true;

    const sync = async () => {
      try {
        const token = await getToken();
        if (!token) {
          onReady();
          return;
        }

        localStorage.setItem('token', token);

        const res = await api.get('/auth/me');
        const data = res.data;
        
        localStorage.setItem('dbRole', data.role);
        localStorage.setItem(
          'currentUser',
          JSON.stringify({ id: data.id, name: data.name, email: data.email, role: data.role })
        );
      } catch (err) {
        // Non-fatal — let the app continue even if sync fails
        console.warn('[RoleSync] Sync failed, continuing:', err.message);
      } finally {
        onReady();
      }
    };

    sync();
  }, [isLoaded, isSignedIn, getToken, onReady]);

  // Renders nothing — purely a side-effect component
  return null;
};

export default RoleSync;
