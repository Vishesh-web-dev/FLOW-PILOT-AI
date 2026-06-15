import apiClient from "./client";
import { ApiResponse, User } from "../types";
import { encryptPassword } from "./crypto";

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
  login: async (credentials: LoginCredentials) => {
    const pw = await encryptPassword(credentials.password);
    return apiClient.post<ApiResponse<AuthResponse>>("/auth/login", {
      email: credentials.email,
      password: pw.value,
      encrypted: pw.encrypted,
    });
  },

  register: async (credentials: RegisterCredentials) => {
    const pw = await encryptPassword(credentials.password);
    return apiClient.post<ApiResponse<AuthResponse>>("/auth/register", {
      name: credentials.name,
      email: credentials.email,
      password: pw.value,
      encrypted: pw.encrypted,
    });
  },

  demoLogin: () =>
    apiClient.post<ApiResponse<AuthResponse>>("/auth/demo"),

  getMe: () => apiClient.get<ApiResponse<User>>("/auth/me"),

  updateProfile: (data: { name?: string; avatar?: string }) =>
    apiClient.put<ApiResponse<User>>("/auth/profile", data),

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const cur = await encryptPassword(data.currentPassword);
    const next = await encryptPassword(data.newPassword);
    // Both fields use the same key, so the encrypted flag is consistent.
    return apiClient.put<ApiResponse<null>>("/auth/password", {
      currentPassword: cur.value,
      newPassword: next.value,
      encrypted: cur.encrypted && next.encrypted,
    });
  },

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
