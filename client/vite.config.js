import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read VITE_* variables from the repo-root .env, next to the server's settings.
  envDir: '..',
  server: {
    port: 5173,
    // In development the API runs separately; in production Express serves both from one URL.
    proxy: { '/api': 'http://localhost:4000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
  },
});
