import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'engine',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
