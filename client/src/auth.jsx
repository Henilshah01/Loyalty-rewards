import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const refresh = useCallback(async () => {
    try {
      setUser((await api('/auth/me')).user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (getToken()) refresh(); }, [refresh]);

  const authenticate = async (path, body) => {
    const { token, user: u } = await api(path, { method: 'POST', body });
    setToken(token);
    setUser(u);
    return u;
  };

  const value = useMemo(() => ({
    user, loading, refresh,
    login: (email, password) => authenticate('/auth/login', { email, password }),
    register: (name, email, password) => authenticate('/auth/register', { name, email, password }),
    logout: () => { setToken(null); setUser(null); },
  }), [user, loading, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
