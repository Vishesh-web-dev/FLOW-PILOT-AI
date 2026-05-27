import apiClient from "./client";
import { ApiResponse, Sprint, CreateSprintForm } from "../types";

export const sprintsApi = {
  getAll: (projectId?: string) =>
    apiClient.get<ApiResponse<Sprint[]>>("/sprints", {
      params: projectId ? { projectId } : undefined,
    }),

  getById: (id: string) => apiClient.get<ApiResponse<Sprint>>(`/sprints/${id}`),

  create: (data: CreateSprintForm) =>
    apiClient.post<ApiResponse<Sprint>>("/sprints", data),

  update: (id: string, data: Partial<CreateSprintForm> & { status?: string }) =>
    apiClient.put<ApiResponse<Sprint>>(`/sprints/${id}`, data),

  delete: (id: string) => apiClient.delete<ApiResponse<{ id: string }>>(`/sprints/${id}`),
};
