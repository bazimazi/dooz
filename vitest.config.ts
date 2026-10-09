import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Keep DOM tests separate from the rules and authoritative server while
    // running all three suites with the same root command and import aliases.
    projects: [
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/game/engine/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'engine',
          environment: 'node',
          include: ['src/game/engine/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts'],
          env: { LOG_LEVEL: 'error' },
        },
      },
    ],
  },
});
