import dts from 'vite-plugin-dts';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: ['src/index.ts', 'src/cli.ts', 'src/playwright.ts'],
      name: '@futo-org/squint',
      formats: ['es'],
    },
    rolldownOptions: {
      output: {
        dir: 'dist',
      },
    },
    ssr: true,
  },
  ssr: {
    noExternal: ['@futo-org/squint-sdk', '@oazapfts/runtime'],
  },
  plugins: [dts({ entryRoot: 'src', tsconfigPath: './tsconfig.json', exclude: ['src/**/*.spec.ts'] })],
});
