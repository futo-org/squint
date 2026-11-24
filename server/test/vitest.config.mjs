import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'squint:unit',
    root,
    globals: true,
    include: ['src/**/*.spec.ts'],
    env: {
      TZ: 'UTC',
    },
  },
  plugins: [swc.vite()],
});
