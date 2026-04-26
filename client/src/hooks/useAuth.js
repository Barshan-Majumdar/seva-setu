import { useAuth as useClerkAuth, useUser } from '@clerk/react';

export const useAuth = () => {
  const { isSignedIn, isLoaded, signOut } = useClerkAuth();
  const { user } = useUser();

  // The DB role is the single source of truth — set by AuthTokenBridge
  const dbRole = localStorage.getItem('dbRole');

  return {
    token: null,
    isLoaded: Boolean(isLoaded),
    currentUser: user
      ? {
          id: user.id,
          name: user.fullName || user.firstName || 'User',
          email: user.primaryEmailAddress?.emailAddress || '',
          role: dbRole || 'user',
        }
      : null,
    isAuthenticated: Boolean(isLoaded && isSignedIn),
    login: () => {},
    logout: () => {
      signOut();
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('dbRole');
      localStorage.removeItem('pendingRole');
    },
  };
};
