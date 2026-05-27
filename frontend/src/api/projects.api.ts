import apiClient from "./client";
import { ApiResponse, Project, CreateProjectForm } from "../types";

export const projectsApi = {
  getAll: () => apiClient.get<ApiResponse<Project[]>>("/projects"),

  getById: (id: string) => apiClient.get<ApiResponse<Project>>(`/projects/${id}`),

  create: (data: CreateProjectForm) =>
    apiClient.post<ApiResponse<Project>>("/projects", data),

  update: (id: string, data: Partial<CreateProjectForm>) =>
    apiClient.put<ApiResponse<Project>>(`/projects/${id}`, data),

  delete: (id: string) => apiClient.delete<ApiResponse<{ id: string }>>(`/projects/${id}`),
};
