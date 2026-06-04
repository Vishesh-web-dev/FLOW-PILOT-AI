import apiClient from "./client";
import { ApiResponse, Schedule, ScheduleItem, ScheduleLog } from "../types";

export interface AnalyticsDayStats {
  date: string;
  total: number;
  done: number;
  rate: number;
}

export interface AnalyticsItemStats {
  id: string;
  title: string;
  category?: string | null;
  totalDays: number;
  doneDays: number;
  rate: number;
}

export interface ScheduleAnalytics {
  overallRate: number;
  totalExpected: number;
  totalDone: number;
  days: number;
  dailyStats: AnalyticsDayStats[];
  itemStats: AnalyticsItemStats[];
}

// ── Schedules ─────────────────────────────────────────────────────────────────

export const schedulerApi = {
  getAll: () =>
    apiClient.get<ApiResponse<Schedule[]>>("/schedules"),

  getOne: (id: string) =>
    apiClient.get<ApiResponse<Schedule>>(`/schedules/${id}`),

  create: (data: {
    name: string;
    description?: string;
    type?: "DAILY" | "WEEKLY" | "MONTHLY";
    items?: Array<{ title: string; description?: string; timeOfDay?: string; category?: string }>;
  }) => apiClient.post<ApiResponse<Schedule>>("/schedules", data),

  update: (id: string, data: Partial<Pick<Schedule, "name" | "description" | "type" | "isActive">>) =>
    apiClient.put<ApiResponse<Schedule>>(`/schedules/${id}`, data),

  remove: (id: string) => apiClient.delete(`/schedules/${id}`),

  // Items
  addItem: (
    scheduleId: string,
    data: { title: string; description?: string; timeOfDay?: string; category?: string }
  ) => apiClient.post<ApiResponse<ScheduleItem>>(`/schedules/${scheduleId}/items`, data),

  updateItem: (
    scheduleId: string,
    itemId: string,
    data: Partial<ScheduleItem>
  ) => apiClient.put<ApiResponse<ScheduleItem>>(`/schedules/${scheduleId}/items/${itemId}`, data),

  deleteItem: (scheduleId: string, itemId: string) =>
    apiClient.delete(`/schedules/${scheduleId}/items/${itemId}`),

  // Logs
  getLogs: (scheduleId: string, date: string) =>
    apiClient.get<ApiResponse<ScheduleLog[]>>(`/schedules/${scheduleId}/logs?date=${date}`),

  toggleLog: (scheduleId: string, data: { itemId: string; date: string; isDone: boolean }) =>
    apiClient.post<ApiResponse<ScheduleLog>>(`/schedules/${scheduleId}/logs/toggle`, data),

  // Analytics
  getAnalytics: (scheduleId: string, days = 30) =>
    apiClient.get<ApiResponse<ScheduleAnalytics>>(`/schedules/${scheduleId}/analytics?days=${days}`),

  // AI generate
  aiGenerate: (prompt: string) =>
    apiClient.post<ApiResponse<Schedule>>("/schedules/ai-generate", { prompt }),
};
