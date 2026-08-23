import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Tauri runs this same build inside its webview, and its CLI sets `TAURI_ENV_*`
 * in the environment. The few branches below are the only places the desktop
 * and mobile targets differ from the plain web build.
 */
const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM);
const tauriHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Tauri ships its own offline bundle, so a service worker there would only
    // add a second, redundant cache to keep in sync.
    ...(isTauri
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'dooz — Tic Tac Toe',
              short_name: 'dooz',
              description: 'Tic Tac Toe on 3x3, 6x6 and 9x9 boards. Play a friend, or the bot.',
              theme_color: '#232599',
              background_color: '#232599',
              display: 'standalone',
              orientation: 'portrait',
              start_url: '/',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                {
                  src: 'icon-512-maskable.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
            },
          }),
        ]),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // Tauri's Rust side reads these, and Vite would otherwise strip them.
  envPrefix: ['VITE_', 'TAURI_ENV_'],

  server: {
    port: 3000,
    strictPort: true,
    // A phone running the mobile dev build loads assets over the network, so the
    // dev server has to listen on the LAN address Tauri reports.
    host: tauriHost ? '0.0.0.0' : undefined,
    hmr: tauriHost ? { protocol: 'ws', host: tauriHost, port: 3001 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },

  build: {
    // Safari on iOS 14 is the oldest webview Tauri mobile supports.
    target: isTauri && process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari14',
    sourcemap: !isTauri,
  },

  worker: {
    format: 'es',
  },
});
