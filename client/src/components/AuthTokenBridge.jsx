import { useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { setTokenProvider } from '../services/api';

/**
 * AuthTokenBridge — Connects Clerk's live authentication state
 * to our central API service (Axios).
 */
const AuthTokenBridge = () => {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      // Register the live getToken function as our API's source of truth.
      // Axios will now call this BEFORE every request, guaranteeing a fresh token.
      setTokenProvider(getToken);
    } else {
      // Clear token and local state if signed out
      setTokenProvider(null);
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('dbRole');
    }
  }, [isSignedIn, isLoaded, getToken]);

  return null;
};

export default AuthTokenBridge;
