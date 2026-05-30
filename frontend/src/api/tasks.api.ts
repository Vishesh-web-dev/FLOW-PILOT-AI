import apiClient from "./client";
import { ApiResponse, Task, CreateTaskForm, TaskStats } from "../types";

export interface TaskFilters {
  status?: string;
  priority?: string;
  projectId?: string;
  sprintId?: string;
  projectIds?: string;   // comma-separated list for multi-select filter
  sprintIds?: string;    // comma-separated list for multi-select filter
  search?: string;
}

export interface ReorderPayload {
  tasks: Array<{ id: string; status: string; position: number }>;
}

export const tasksApi = {
  getAll: (filters?: TaskFilters) =>
    apiClient.get<ApiResponse<Task[]>>("/tasks", { params: filters }),

  getById: (id: string) => apiClient.get<ApiResponse<Task>>(`/tasks/${id}`),

  create: (data: CreateTaskForm) =>
    apiClient.post<ApiResponse<Task>>("/tasks", data),

  update: (id: string, data: Partial<CreateTaskForm> & { position?: number }) =>
    apiClient.put<ApiResponse<Task>>(`/tasks/${id}`, data),

  delete: (id: string) => apiClient.delete<ApiResponse<{ id: string }>>(`/tasks/${id}`),

  reorder: (payload: ReorderPayload) =>
    apiClient.patch<ApiResponse<{ updated: number }>>("/tasks/reorder", payload),

  getStats: () => apiClient.get<ApiResponse<TaskStats>>("/tasks/stats"),
};
