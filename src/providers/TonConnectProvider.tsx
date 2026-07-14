import { TonConnectUIProvider, THEME } from '@tonconnect/ui-react';
import type { ReactNode } from 'react';

const MANIFEST_URL =
  (import.meta.env.VITE_TONCONNECT_MANIFEST_URL as string) ||
  'https://bid.tg/tonconnect-manifest.json';

export function TonConnectProvider({ children }: { children: ReactNode }) {
  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      uiPreferences={{
        theme: THEME.DARK,
        colorsSet: {
          [THEME.DARK]: {
            accent: '#5ffbf1',
            telegramButton: '#5ffbf1',
            connectButton: { background: '#eef2f5', foreground: '#05060a' },
            background: {
              primary: '#05060a',
              secondary: '#0a0c12',
              segment: '#12151d',
              tint: 'rgba(95, 251, 241, 0.10)',
              qr: '#ffffff',
            },
            text: { primary: '#e6ebf0', secondary: 'rgba(230, 235, 240, 0.7)' },
            icon: {
              primary: '#5ffbf1',
              secondary: 'rgba(95, 251, 241, 0.6)',
              tertiary: 'rgba(95, 251, 241, 0.3)',
              success: '#39ff14',
              error: '#ff3860',
            },
          },
        },
      }}
      actionsConfiguration={{ twaReturnUrl: 'https://t.me/bidtg_bot' }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
