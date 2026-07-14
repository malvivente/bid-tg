/**
 * Thin, defensive wrapper around the Telegram WebApp bridge (telegram-web-app.js,
 * loaded in index.html). Everything degrades gracefully when the app is opened
 * in a plain browser (dev/preview), so the UI is fully usable outside Telegram.
 *
 * The RAW initData string is what the backend must cryptographically validate
 * (HMAC-SHA256, key = HMAC(bot_token, "WebAppData")). We never trust parsed
 * initDataUnsafe for authorization.
 */

interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: TgUser };
  colorScheme?: 'light' | 'dark';
  themeParams?: Record<string, string>;
  viewportStableHeight?: number;
  isExpanded?: boolean;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  HapticFeedback?: {
    impactOccurred: (s: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (t: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function tg(): TelegramWebApp | undefined {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
}

export function isTelegram(): boolean {
  const w = tg();
  return !!w && typeof w.initData === 'string' && w.initData.length > 0;
}

export function initTelegram(): void {
  const w = tg();
  if (!w) return;
  try {
    w.ready();
    w.expand();
    w.setHeaderColor?.('#0a0907');
    w.setBackgroundColor?.('#0a0907');
    const h = w.viewportStableHeight;
    if (h) document.documentElement.style.setProperty('--tg-viewport-stable-height', `${h}px`);
  } catch {
    /* no-op outside Telegram */
  }
}

/** Raw initData for backend auth (empty string in a browser). */
export function getInitData(): string {
  return tg()?.initData ?? '';
}

export function getTgUser(): TgUser | undefined {
  return tg()?.initDataUnsafe?.user;
}

export const haptic = {
  impact(style: 'light' | 'medium' | 'heavy' = 'light') {
    tg()?.HapticFeedback?.impactOccurred(style);
  },
  success() {
    tg()?.HapticFeedback?.notificationOccurred('success');
  },
  error() {
    tg()?.HapticFeedback?.notificationOccurred('error');
  },
  select() {
    tg()?.HapticFeedback?.selectionChanged();
  },
};
