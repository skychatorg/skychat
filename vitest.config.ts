import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/server/**/*.test.ts'],
        setupFiles: ['test/server/setup.ts', 'test/server/load-server.ts'],
        // setup.ts calls process.chdir, which worker threads do not allow
        pool: 'forks',
    },
});
