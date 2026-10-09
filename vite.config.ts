import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Tauri runs this same build inside its webview, and its CLI sets `TAURI_ENV_*`
 * in the environment. The few branches below are the only places the desktop
 * and mobile targets differ from the plain web build.
 */
const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM);
const tauriHost = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => {
  const publicUrl = loadEnv(
    mode,
    fileURLToPath(new URL('.', import.meta.url)),
    'VITE_',
  ).VITE_PUBLIC_URL;
  return {
    // Keep Rust compiler diagnostics visible while the frontend reloads.
    clearScreen: false,
    plugins: [
      {
        name: 'dooz-social-image-url',
        transformIndexHtml(html) {
          if (!publicUrl) return html;
          const imageUrl = new URL('brand/social-card.jpg', `${publicUrl.replace(/\/$/, '')}/`)
            .href;
          return html.replaceAll(
            'content="/brand/social-card.jpg"',
            `content="${imageUrl.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`,
          );
        },
      },
      react(),
      tailwindcss(),
      // Tauri ships its own offline bundle, so a service worker there would only
      // add a second, redundant cache to keep in sync.
      ...(isTauri
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: [
                'brand/favicon.svg',
                'brand/favicon.ico',
                'brand/apple-touch-icon.png',
              ],
              manifest: {
                name: 'dooz - in-a-row strategy',
                short_name: 'dooz',
                description:
                  'Tic Tac Toe, Gomoku, Misère, Gravity, Vanish and Ultimate. Play a friend, a six-level bot, a daily puzzle, a journey of rivals, or a rated ladder.',
                theme_color: '#232599',
                background_color: '#232599',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                icons: [
                  {
                    src: 'brand/icon-192.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'any',
                  },
                  {
                    src: 'brand/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any',
                  },
                  {
                    src: 'brand/icon-512-maskable.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
                // Source/export artwork is not needed to play offline.
                globIgnores: ['brand/*1024.png', 'brand/mark.svg', 'brand/app-icon.svg'],
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
  };
});
