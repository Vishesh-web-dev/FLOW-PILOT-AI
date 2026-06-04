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

export interface AnalyticsDowStats {
  name: string;
  done: number;
  total: number;
  rate: number;
}

export interface ScheduleAnalytics {
  overallRate: number;
  totalExpected: number;
  totalDone: number;
  days: number;
  from: string;
  to: string;
  currentStreak: number;
  longestStreak: number;
  dailyStats: AnalyticsDayStats[];
  itemStats: AnalyticsItemStats[];
  dowStats: AnalyticsDowStats[];
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
    data: { title: string; description?: string; timeOfDay?: string; category?: string; order?: number }
  ) => apiClient.post<ApiResponse<ScheduleItem>>(`/schedules/${scheduleId}/items`, data),

  updateItem: (
    scheduleId: string,
    itemId: string,
    data: Partial<ScheduleItem>
  ) => apiClient.put<ApiResponse<ScheduleItem>>(`/schedules/${scheduleId}/items/${itemId}`, data),

  deleteItem: (scheduleId: string, itemId: string) =>
    apiClient.delete(`/schedules/${scheduleId}/items/${itemId}`),

  reorderItems: (scheduleId: string, items: Array<{ id: string; order: number }>) =>
    apiClient.put(`/schedules/${scheduleId}/items/reorder`, { items }),

  // Logs
  getLogs: (scheduleId: string, date: string) =>
    apiClient.get<ApiResponse<ScheduleLog[]>>(`/schedules/${scheduleId}/logs?date=${date}`),

  toggleLog: (scheduleId: string, data: { itemId: string; date: string; isDone: boolean }) =>
    apiClient.post<ApiResponse<ScheduleLog>>(`/schedules/${scheduleId}/logs/toggle`, data),

  // Analytics — ?from=YYYY-MM-DD&to=YYYY-MM-DD  OR  ?days=N  (always sends &tz=)
  getAnalytics: (scheduleId: string, params: { days?: number; from?: string; to?: string; tz?: string } = { days: 30 }) => {
    // Always include the browser's local timezone so the backend can compute
    // "today" correctly and align DOW labels with the user's locale
    const tz = params.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rangeQ = params.from && params.to
      ? `from=${params.from}&to=${params.to}`
      : `days=${params.days ?? 30}`;
    return apiClient.get<ApiResponse<ScheduleAnalytics>>(
      `/schedules/${scheduleId}/analytics?${rangeQ}&tz=${encodeURIComponent(tz)}`
    );
  },

  // AI generate
  aiGenerate: (prompt: string) =>
    apiClient.post<ApiResponse<Schedule>>("/schedules/ai-generate", { prompt }),
};
