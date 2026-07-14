import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    // Same-origin proxy to Fragment's PUBLIC pages so the client can read real data without
    // the backend. For the gift catalog (searchAuctions) Fragment requires its anon stel_ssid
    // cookie + a fragment.com Origin, so we rewrite Set-Cookie (drop Secure/Domain so the
    // browser keeps it over http localhost) and force the Origin on the way out. Read-only.
    proxy: {
      '/frag': {
        target: 'https://fragment.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/frag/, ''),
        configure: (proxy) => {
          const UA =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('user-agent', UA);
            proxyReq.setHeader('origin', 'https://fragment.com');
          });
          proxy.on('proxyRes', (proxyRes) => {
            const sc = proxyRes.headers['set-cookie'];
            if (sc)
              proxyRes.headers['set-cookie'] = sc.map((c) =>
                c
                  .replace(/;\s*Secure/gi, '')
                  .replace(/;\s*Domain=[^;]+/gi, '')
                  .replace(/SameSite=None/gi, 'SameSite=Lax'),
              );
          });
        },
      },
    },
  },
});
