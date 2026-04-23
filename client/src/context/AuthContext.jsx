import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContextObject';

const decodeJwtPayload = (rawToken) => {
  if (!rawToken) return null;

  try {
    const parts = rawToken.split('.');
    if (parts.length < 2) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(() => {
    const raw = localStorage.getItem('currentUser');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem('currentUser');
      return null;
    }
  });

  const login = ({ token: nextToken, user }) => {
    setToken(nextToken);
    setCurrentUser(user);
    localStorage.setItem('token', nextToken);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const logout = useCallback(() => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      logout();
    };

    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [logout]);

  useEffect(() => {
    if (!token) return undefined;

    const payload = decodeJwtPayload(token);
    const expiresAtMs = Number(payload?.exp) * 1000;
    if (!expiresAtMs || Number.isNaN(expiresAtMs)) return undefined;

    const msUntilExpiry = expiresAtMs - Date.now();

    if (msUntilExpiry <= 0) {
      queueMicrotask(() => {
        logout();
      });
      return undefined;
    }

    const timer = setTimeout(() => {
      logout();
    }, msUntilExpiry);

    return () => clearTimeout(timer);
  }, [token, logout]);

  const value = useMemo(
    () => ({
      token,
      currentUser,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, currentUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
