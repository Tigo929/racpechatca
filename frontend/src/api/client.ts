import axios from 'axios';

/**
 * Единый HTTP-клиент для всех API-модулей.
 * Раньше axios-инстанс с интерсепторами дублировался в auth.ts и orders.ts —
 * теперь один источник: токен подставляется в каждый запрос, 401 уводит на логин.
 */
export const api = axios.create({ baseURL: '' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url: string = err.config?.url ?? '';
    // На логине 401 — это «неверный пароль», его показываем формой, не редиректим.
    if (err.response?.status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem('access_token');
      window.location.href = '/crm/login';
    }
    return Promise.reject(err);
  },
);
