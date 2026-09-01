import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import client, { api } from '../api/client';

const AuthContext = createContext({ user: null, token: null, plan: null, loading: true, login: () => {}, logout: () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const tok = await SecureStore.getItemAsync('gdp_token');
        if (tok) {
          setToken(tok);
          const res = await api.me();
          if (res.usuario) { setUser(res.usuario); setPlan(res.plan || null); }
        }
      } catch (e) {
        await SecureStore.deleteItemAsync('gdp_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const res = await client.post('/api/login', { email, password });
    const { token: tok, usuario } = res.data;
    await SecureStore.setItemAsync('gdp_token', tok);
    setToken(tok);
    setUser(usuario);
    try { const me = await api.me(); if (me.plan) setPlan(me.plan); } catch {}
    return usuario;
  };

  const logout = async () => {
    try { await client.post('/api/logout'); } catch {}
    await SecureStore.deleteItemAsync('gdp_token');
    setToken(null);
    setUser(null);
    setPlan(null);
  };

  const value = useMemo(() => ({ user, token, plan, loading, login, logout }), [user, token, plan, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
