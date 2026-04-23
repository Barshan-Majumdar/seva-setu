import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/react';

const AuthTokenBridge = () => {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    let cancelled = false;
    let intervalId;

    const sync = async () => {
      if (!isSignedIn) {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        return;
      }

      const token = await getToken();
      if (cancelled) return;

      if (token) {
        localStorage.setItem('token', token);
      }

      if (user) {
        const currentUser = {
          id: user.id,
          name: user.fullName || user.firstName || 'User',
          email: user.primaryEmailAddress?.emailAddress || '',
          role: user.publicMetadata?.role || 'volunteer',
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    };

    sync().catch((err) => {
      console.error('Failed to sync Clerk token:', err);
    });

    if (isSignedIn) {
      intervalId = setInterval(() => {
        sync().catch((err) => {
          console.error('Token refresh sync failed:', err);
        });
      }, 55 * 1000);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSignedIn, getToken, user]);

  return null;
};

export default AuthTokenBridge;
