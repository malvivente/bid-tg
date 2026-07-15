import { useEffect, useRef } from 'react';

/** Bot USERNAME (no @) whose domain is registered in BotFather via /setdomain. */
const BOT = import.meta.env.VITE_TG_LOGIN_BOT as string | undefined;

/**
 * The classic "Log in with Telegram" widget. It injects an <iframe> button served from
 * oauth.telegram.org and, on success, calls a global function with the signed payload
 * { id, first_name, …, auth_date, hash }, which the backend re-validates (HMAC over
 * SHA256(bot_token)). Requires the site's domain to be registered in BotFather (/setdomain);
 * otherwise the button renders but refuses to authenticate.
 */
export function TelegramLoginButton({ onAuth }: { onAuth: (payload: Record<string, unknown>) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const cb = useRef(onAuth);
  cb.current = onAuth;

  useEffect(() => {
    const el = container.current;
    if (!BOT || !el) return;
    // The widget's data-onauth calls a function by name on `window`.
    (window as unknown as Record<string, unknown>).__bidtgOnTelegramAuth = (user: Record<string, unknown>) =>
      cb.current(user);
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', BOT);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '8');
    s.setAttribute('data-request-access', 'write');
    s.setAttribute('data-onauth', '__bidtgOnTelegramAuth(user)');
    el.appendChild(s);
    return () => {
      delete (window as unknown as Record<string, unknown>).__bidtgOnTelegramAuth;
      el.innerHTML = '';
    };
  }, []);

  if (!BOT) {
    return (
      <p className="text-center text-[11px] text-god-faint">
        Telegram login isn’t configured (set VITE_TG_LOGIN_BOT).
      </p>
    );
  }
  return <div ref={container} className="flex justify-center" />;
}
