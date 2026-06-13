import axios, { type AxiosError } from 'axios';

interface ApiErrorBody {
  message?: string | string[];
}

function isApiError(error: unknown): error is AxiosError<ApiErrorBody> {
  return axios.isAxiosError<ApiErrorBody>(error);
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Произошла ошибка',
): string {
  if (!isApiError(error)) return fallback;

  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? fallback;
}
