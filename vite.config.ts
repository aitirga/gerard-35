import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works both locally and under
  // a sub-path like https://aitirga.github.io/gerard-35/
  base: './',
  // `just backend` listens on 8035 (GERARD_API_PORT); GERARD_API points the proxy at any other backend.
  server: { proxy: { '/api': process.env.GERARD_API ?? `http://127.0.0.1:${process.env.GERARD_API_PORT ?? 8035}` } },
  build: {
    rollupOptions: { input: { game: 'index.html', combatLab: 'combat-lab.html' } },
    // The PlayCanvas engine makes the game a single ~2.6 MB chunk; that's expected.
    chunkSizeWarningLimit: 3000,
  },
});
