import axios, { type AxiosError } from 'axios';

interface ApiErrorBody {
  message?: string | string[];
  error?: string;
}

function isApiError(error: unknown): error is AxiosError<ApiErrorBody> {
  return axios.isAxiosError<ApiErrorBody>(error);
}

/**
 * Текст ошибки для показа человеку.
 *
 * Раньше при любом непонятном ответе подставлялась общая заглушка вроде
 * «Не удалось сохранить». На экране это выглядит одинаково и для «такой
 * кабинет уже подключён», и для «сервер недоступен», и для «упал запрос» —
 * то есть сообщение не помогало ни пользователю, ни разбору.
 *
 * Поэтому: сначала текст от сервера, а если его нет — хотя бы то, что
 * известно точно: код ответа или отсутствие связи.
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Произошла ошибка',
): string {
  if (!isApiError(error)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  const message = error.response?.data?.message;
  if (Array.isArray(message) && message.length) return message.join(', ');
  if (typeof message === 'string' && message.trim()) return message;

  // Ответ пришёл, но без внятного текста — называем код: по нему понятно,
  // отказ это (4xx, дело в данных) или поломка сервера (5xx).
  const status = error.response?.status;
  if (status) {
    const known: Record<number, string> = {
      401: 'Сессия истекла — войдите заново',
      403: 'Недостаточно прав',
      404: 'Не найдено',
      409: 'Уже существует',
      413: 'Файл слишком большой',
      429: 'Слишком часто — подождите минуту',
    };
    return known[status] ?? `${fallback} (ответ сервера ${status})`;
  }

  // Ответа нет вовсе: сервер недоступен, оборвалась сеть или запрос не
  // прошёл проверку браузера. Это не «не удалось сохранить» — тут нечего
  // исправлять в форме, и человеку важно понимать разницу.
  return 'Сервер не ответил — проверьте связь и повторите';
}
