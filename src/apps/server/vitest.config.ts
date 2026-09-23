import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      // The server logs a line per connection, match and result. That is what
      // it is for in production and pure noise around an assertion, so the
      // suite raises the threshold above everything but real errors.
      LOG_LEVEL: 'error',
    },
  },
});
