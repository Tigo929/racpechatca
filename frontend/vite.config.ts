import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    // Прокси на backend в дев-режиме (в проде этим занимается nginx).
    // Без него относительные запросы /order-photo, /auth, /users
    // попадали бы в SPA-фолбэк, а не в API.
    proxy: {
      '/order-photo': { target: 'http://localhost:3000', changeOrigin: true },
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/users': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
