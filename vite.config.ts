import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works both locally and under
  // a sub-path like https://aitirga.github.io/gerard-35/
  base: './',
  server: { proxy: { '/api': 'http://127.0.0.1:8080' } },
  build: {
    // The PlayCanvas engine is a single ~2 MB chunk; that's expected.
    chunkSizeWarningLimit: 2500,
  },
});
