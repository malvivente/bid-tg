/**
 * Web-login session storage (browser only). Kept dependency-free and separate from the auth
 * context + api client so both can read the token without an import cycle. In the Mini App
 * this is unused — there the request is authenticated with `tma <initData>` instead.
 */
export interface AuthUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

const TOKEN_KEY = 'bidtg_session';
const USER_KEY = 'bidtg_user';

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // private mode / disabled storage
  }
}

export function getStoredToken(): string | null {
  return ls()?.getItem(TOKEN_KEY) ?? null;
}

export function getStoredUser(): AuthUser | null {
  const raw = ls()?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: AuthUser): void {
  const s = ls();
  s?.setItem(TOKEN_KEY, token);
  s?.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  const s = ls();
  s?.removeItem(TOKEN_KEY);
  s?.removeItem(USER_KEY);
}
