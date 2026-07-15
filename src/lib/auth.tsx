import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { getStoredToken, getStoredUser, storeSession, clearSession, type AuthUser } from './session';
import { loginWithTelegram } from './api';

/**
 * Web-login auth state. Only relevant when the app runs as a WEBSITE (plain browser); inside
 * the Mini App the request is authenticated with `tma <initData>` and this stays null.
 */
interface AuthCtx {
  user: AuthUser | null;
  loggedIn: boolean;
  login: (payload: Record<string, unknown>) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate from a previously-stored session (only trust the user if a token is present).
  const [user, setUser] = useState<AuthUser | null>(() => (getStoredToken() ? getStoredUser() : null));

  const login = useCallback(async (payload: Record<string, unknown>) => {
    const res = await loginWithTelegram(payload);
    storeSession(res.token, res.user);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loggedIn: !!user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
