import { useAuth as useClerkAuth, useUser } from '@clerk/react';

export const useAuth = () => {
  const { isSignedIn, signOut } = useClerkAuth();
  const { user } = useUser();

  return {
    token: null,
    currentUser: user
      ? {
          id: user.id,
          name: user.fullName || user.firstName || 'User',
          email: user.primaryEmailAddress?.emailAddress || '',
          role: user.publicMetadata?.role || 'volunteer',
        }
      : null,
    isAuthenticated: Boolean(isSignedIn),
    login: () => {},
    logout: () => {
      signOut();
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
    },
  };
};
