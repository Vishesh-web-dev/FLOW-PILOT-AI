import apiClient from "./client";
import { ApiResponse, Activity } from "../types";

export interface DailySummaryResponse {
  date: string;
  summary: {
    totalActivities: number;
    tasksCreated: number;
    tasksCompleted: number;
    remindersSet: number;
  };
  activities: Activity[];
}

export const activitiesApi = {
  getAll: (params?: { limit?: number; page?: number }) =>
    apiClient.get<ApiResponse<Activity[]>>("/activities", { params }),

  getDailySummary: () =>
    apiClient.get<ApiResponse<DailySummaryResponse>>("/activities/summary"),
};
