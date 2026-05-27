import apiClient from "./client";
import { ApiResponse, Reminder } from "../types";

export interface CreateReminderForm {
  title: string;
  description?: string;
  remindAt: string;
}

export const remindersApi = {
  getAll: (completed?: boolean) =>
    apiClient.get<ApiResponse<Reminder[]>>("/reminders", {
      params: completed !== undefined ? { completed } : undefined,
    }),

  create: (data: CreateReminderForm) =>
    apiClient.post<ApiResponse<Reminder>>("/reminders", data),

  update: (id: string, data: Partial<CreateReminderForm>) =>
    apiClient.put<ApiResponse<Reminder>>(`/reminders/${id}`, data),

  complete: (id: string) =>
    apiClient.patch<ApiResponse<Reminder>>(`/reminders/${id}/complete`),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<{ id: string }>>(`/reminders/${id}`),
};
