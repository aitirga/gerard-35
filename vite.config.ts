import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works both locally and under
  // a sub-path like https://aitirga.github.io/gerard-35/
  base: './',
  // GERARD_API points the proxy at a backend on another port (8080 is `just backend`).
  server: { proxy: { '/api': process.env.GERARD_API ?? 'http://127.0.0.1:8080' } },
  build: {
    rollupOptions: { input: { game: 'index.html', combatLab: 'combat-lab.html' } },
    // The PlayCanvas engine is a single ~2 MB chunk; that's expected.
    chunkSizeWarningLimit: 2500,
  },
});
