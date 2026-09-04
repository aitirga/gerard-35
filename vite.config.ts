import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works both locally and under
  // a sub-path like https://aitirga.github.io/gerard-35/
  base: './',
  build: {
    // The PlayCanvas engine is a single ~2 MB chunk; that's expected.
    chunkSizeWarningLimit: 2500,
  },
});
