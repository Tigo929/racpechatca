import type { AppUser } from '../types/index';
import { api } from './client';

/** Управление пользователями (исполнители/админы). */
export const usersApi = {
  getAll: async (): Promise<AppUser[]> => {
    const { data } = await api.get<AppUser[]>('/users');
    return data;
  },

  create: async (username: string, password: string, role: string): Promise<AppUser> => {
    const { data } = await api.post<AppUser>('/users', { username, password, role });
    return data;
  },

  update: async (
    id: string,
    patch: { isActive?: boolean; rateBasisPoints?: number },
  ): Promise<AppUser> => {
    const { data } = await api.patch<AppUser>(`/users/${id}`, patch);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};
