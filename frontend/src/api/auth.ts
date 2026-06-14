import type { LoginResponse, AuthUser } from '../types/index';
import { api } from './client';

/** Аутентификация: вход и текущий пользователь. */
export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post<LoginResponse>('/auth/login', { username, password });
    return data;
  },

  me: async (): Promise<AuthUser> => {
    const { data } = await api.get<AuthUser>('/auth/me');
    return data;
  },
};
