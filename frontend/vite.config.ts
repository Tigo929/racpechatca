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
    // попадали бы в SPA-фолбэк, а не в API: фронт молча получает HTML
    // вместо JSON, и раздел выглядит пустым без единой ошибки в логах.
    //
    // Список обязан покрывать все контроллеры бэкенда — за этим следит
    // тест crm-new/src/nginx-routes.spec.ts. Маршруты панели живут под
    // /crm/..., поэтому пересечься с ними эти префиксы не могут.
    proxy: Object.fromEntries(
      [
        '/health',
        '/auth',
        '/users',
        '/order-photo',
        '/salary',
        '/reports',
        '/expenses',
        '/tasks',
        '/scenarios',
        '/avito',
        '/marketplace',
        '/canvas',
        '/partner',
        '/partner-settings',
        '/telegram',
        '/approvals',
        '/mockup-templates',
      ].map((prefix) => [
        prefix,
        { target: 'http://localhost:3000', changeOrigin: true },
      ]),
    ),
  },
});
