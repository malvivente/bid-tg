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

interface SafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
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
  /** Bot API 8.0+ */
  isVersionAtLeast?: (version: string) => boolean;
  isFullscreen?: boolean;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  onEvent?: (event: string, cb: (payload?: unknown) => void) => void;
  offEvent?: (event: string, cb: (payload?: unknown) => void) => void;
  /** device notch / system UI */
  safeAreaInset?: SafeAreaInset;
  /** Telegram's OWN floating controls (close/menu) in fullscreen */
  contentSafeAreaInset?: SafeAreaInset;
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
    w.expand(); // safe on every Bot API version (fills the sheet, still under Telegram's header)
    w.setHeaderColor?.('#05060a');
    w.setBackgroundColor?.('#05060a');
    const h = w.viewportStableHeight;
    if (h) document.documentElement.style.setProperty('--tg-viewport-stable-height', `${h}px`);

    // FULLSCREEN — Bot API 8.0+. The app then covers the whole screen and Telegram's close/
    // menu buttons FLOAT OVER it, so layout must clear them: Telegram publishes the insets
    // itself as --tg-safe-area-inset-* (device notch) and --tg-content-safe-area-inset-*
    // (its own controls), which index.css folds into --safe-top/--safe-bottom. No JS layout
    // needed — Telegram rewrites those vars on every change and the CSS reflows for free.
    //
    // The version gate is REQUIRED, not polish: requestFullscreen() THROWS on clients below
    // 8.0 rather than no-op'ing. If the platform refuses (fullscreenFailed → UNSUPPORTED),
    // we simply stay in expanded mode, which the same --safe-* vars already handle.
    if (w.isVersionAtLeast?.('8.0')) {
      w.onEvent?.('fullscreenChanged', () => {
        document.body.classList.toggle('is-fullscreen', !!w.isFullscreen);
      });
      w.onEvent?.('fullscreenFailed', () => {
        document.body.classList.remove('is-fullscreen');
      });
      w.requestFullscreen?.();
    }
  } catch {
    /* no-op outside Telegram (and belt-and-braces around requestFullscreen) */
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
