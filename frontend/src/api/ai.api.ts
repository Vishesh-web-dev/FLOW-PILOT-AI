import apiClient from "./client";
import { ApiResponse, AICommandResponse } from "../types";

export interface AICommandPayload {
  command: string;
  projectId?: string;
  sprintId?: string;
}

export interface AIHistoryItem {
  id: string;
  input: string;
  actionType: string;
  createdAt: string;
}

export interface SprintPlanPayload {
  goal: string;
  durationDays?: number;
}

export const aiApi = {
  processCommand: (payload: AICommandPayload) =>
    apiClient.post<ApiResponse<AICommandResponse>>("/ai/command", payload),

  getHistory: (limit?: number) =>
    apiClient.get<ApiResponse<AIHistoryItem[]>>("/ai/history", {
      params: limit ? { limit } : undefined,
    }),

  generateSummary: () =>
    apiClient.post<ApiResponse<{ summary: string; date: string }>>("/ai/summary"),

  generateSprintPlan: (payload: SprintPlanPayload) =>
    apiClient.post<ApiResponse<unknown>>("/ai/sprint-plan", payload),
};
