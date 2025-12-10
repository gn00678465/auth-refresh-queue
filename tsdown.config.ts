import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    core: './src/core/index.ts',
  },
  format: ['esm', 'cjs'],
  clean: true,
  dts: true,
});
