import axios from 'axios';
import type { LoginResponse, AuthUser, AppUser } from '../types';

const api = axios.create({
  baseURL: '',
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post<LoginResponse>('/auth/login', { username, password });
    return data;
  },

  me: async (): Promise<AuthUser> => {
    const { data } = await api.get<AuthUser>('/auth/me');
    return data;
  },

  getUsers: async (): Promise<AppUser[]> => {
    const { data } = await api.get<AppUser[]>('/users');
    return data;
  },

  createUser: async (username: string, password: string, role: string): Promise<AppUser> => {
    const { data } = await api.post<AppUser>('/users', { username, password, role });
    return data;
  },

  updateUser: async (
    id: string,
    patch: { isActive?: boolean; rateBasisPoints?: number },
  ): Promise<AppUser> => {
    const { data } = await api.patch<AppUser>(`/users/${id}`, patch);
    return data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};
