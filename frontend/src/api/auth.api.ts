import apiClient from "./client";
import { ApiResponse, User } from "../types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient.post<ApiResponse<AuthResponse>>("/auth/login", credentials),

  register: (credentials: RegisterCredentials) =>
    apiClient.post<ApiResponse<AuthResponse>>("/auth/register", credentials),

  demoLogin: () =>
    apiClient.post<ApiResponse<AuthResponse>>("/auth/demo"),

  getMe: () => apiClient.get<ApiResponse<User>>("/auth/me"),

  updateProfile: (data: { name?: string; avatar?: string }) =>
    apiClient.put<ApiResponse<User>>("/auth/profile", data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.put<ApiResponse<null>>("/auth/password", data),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return apiClient.post<ApiResponse<User>>("/auth/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  deleteAvatar: () =>
    apiClient.delete<ApiResponse<User>>("/auth/avatar"),
};
