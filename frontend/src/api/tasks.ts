import type {
  CreateTaskDto, EnumTaskStatus, Task, TaskCountResponse,
} from '../types/index';
import { api } from './client';

export interface TasksQuery {
  status?: EnumTaskStatus;
  assigneeId?: string;
}

export const tasksApi = {
  getAll: async (query: TasksQuery = {}): Promise<Task[]> => {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.assigneeId) params.set('assigneeId', query.assigneeId);
    const qs = params.toString();
    const { data } = await api.get<Task[]>(`/tasks${qs ? `?${qs}` : ''}`);
    return data;
  },

  count: async (): Promise<TaskCountResponse> => {
    const { data } = await api.get<TaskCountResponse>('/tasks/count');
    return data;
  },

  create: async (dto: CreateTaskDto): Promise<Task> => {
    const { data } = await api.post<Task>('/tasks', dto);
    return data;
  },

  update: async (id: string, dto: Partial<CreateTaskDto>): Promise<Task> => {
    const { data } = await api.patch<Task>(`/tasks/${id}`, dto);
    return data;
  },

  setStatus: async (id: string, status: EnumTaskStatus): Promise<Task> => {
    const { data } = await api.patch<Task>(`/tasks/${id}/status`, { status });
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/tasks/${id}`);
  },
};
