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

  getMe: () => apiClient.get<ApiResponse<User>>("/auth/me"),

  updateProfile: (data: { name?: string; avatar?: string }) =>
    apiClient.put<ApiResponse<User>>("/auth/profile", data),
};
