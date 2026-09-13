import react from '@vitejs/plugin-react';

/**
 * Тесты панели (vitest + testing-library) — пока только дашборд аналитики.
 * Отдельный файл, а не блок `test` в vite.config.ts: типы vitest собраны под
 * vite 7, а проект на vite 8, и общий defineConfig не сходится по типам
 * плагинов. Обычный объект vitest читает так же.
 */
export default {
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
};
