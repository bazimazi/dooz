import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Every workspace that has tests, including the client - which was left out
    // here while carrying a vitest config of its own, so `npm test` reported
    // green without ever having run a line of it.
    projects: ['packages/*', 'apps/server', 'apps/web'],
  },
});
