import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null)).finally(() => setLoading(false));
    const onUnauthorized = () => setUser(null);
    window.addEventListener('nx:unauthorized', onUnauthorized);
    return () => window.removeEventListener('nx:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api.post('/auth/login', { email, password });
    setUser(d.user);
  }, []);
  const signup = useCallback(async (body) => {
    const d = await api.post('/auth/signup', body);
    setUser(d.user);
  }, []);
  const logout = useCallback(async (everywhere = false) => {
    await api.post(everywhere ? '/auth/logout-all' : '/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
