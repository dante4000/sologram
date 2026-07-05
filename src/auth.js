import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadCreds, saveCreds, clearCreds } from './storage';
import * as api from './api';

const SIXTY_DAYS = 60 * 24 * 3600 * 1000;
const TEN_DAYS = 10 * 24 * 3600 * 1000;

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [creds, setCreds] = useState({
    token: null,
    userId: null,
    username: null,
    accountType: null,
    expiresAt: null,
  });
  const [loading, setLoading] = useState(true);

  // Load stored creds on launch, then opportunistically refresh a token that is
  // close to expiry (the refresh call does NOT need the app secret).
  useEffect(() => {
    (async () => {
      const c = await loadCreds();
      setCreds(c);
      setLoading(false);
      if (c.token && c.expiresAt) {
        const ms = Number(c.expiresAt) - Date.now();
        if (ms > 0 && ms < TEN_DAYS) {
          try {
            const r = await api.refreshToken(c.token);
            const expiresAt = String(Date.now() + r.expires_in * 1000);
            await saveCreds({ token: r.access_token, expiresAt });
            setCreds((prev) => ({ ...prev, token: r.access_token, expiresAt }));
          } catch {
            /* ignore; user can refresh manually in Settings */
          }
        }
      }
    })();
  }, []);

  const connect = useCallback(async (token) => {
    const me = await api.getMe(token); // throws if token is invalid
    const userId = me.user_id ? String(me.user_id) : String(me.id);
    const next = {
      token,
      userId,
      username: me.username || '',
      accountType: me.account_type || '',
      expiresAt: String(Date.now() + SIXTY_DAYS), // long-lived tokens last ~60d
    };
    await saveCreds(next);
    setCreds(next);
    return me;
  }, []);

  const refresh = useCallback(async () => {
    const r = await api.refreshToken(creds.token);
    const expiresAt = String(Date.now() + r.expires_in * 1000);
    await saveCreds({ token: r.access_token, expiresAt });
    setCreds((prev) => ({ ...prev, token: r.access_token, expiresAt }));
    return r;
  }, [creds.token]);

  const disconnect = useCallback(async () => {
    await clearCreds();
    setCreds({ token: null, userId: null, username: null, accountType: null, expiresAt: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...creds, loading, connect, refresh, disconnect }}>
      {children}
    </AuthContext.Provider>
  );
}
