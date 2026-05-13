import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    exclude: ['.codex-run/**', 'node_modules/**', 'dist/**'],
    environmentOptions: {
      jsdom: {
        url: 'https://ajyn.test',
      },
    },
    clearMocks: true,
    restoreMocks: true,
  },
});
