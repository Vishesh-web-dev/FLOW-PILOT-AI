import { Request } from "express";
import { TaskStatus, Priority, SprintStatus, ActivityType } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  labels?: string[];
  estimatedHours?: number;
  projectId?: string;
  sprintId?: string;
  parentId?: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  position?: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
}

export interface CreateSprintInput {
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}

export interface CreateReminderInput {
  title: string;
  description?: string;
  remindAt: string;
}

export interface AIActionResult {
  type:
    | "CREATE_TASK"
    | "CREATE_TASKS"
    | "CREATE_REMINDER"
    | "SUMMARIZE"
    | "CREATE_SPRINT"
    | "BREAKDOWN_TASK"
    | "SCHEDULE_EVENT"
    | "UPDATE_TASK_STATUS"
    | "UPDATE_TASK"
    | "DELETE_TASK"
    | "DELETE_TASKS"
    | "COMPLETE_TASKS"
    | "MOVE_TASKS_TO_SPRINT"
    | "UNKNOWN";
  tasks?: Array<{
    title: string;
    description?: string;
    priority?: Priority;
    dueDate?: string;
    labels?: string[];
    estimatedHours?: number;
  }>;
  // For operations on existing tasks
  taskTitle?: string;
  taskTitles?: string[];
  newStatus?: string;
  sprintName?: string;
  updates?: {
    priority?: Priority;
    dueDate?: string;
    labels?: string[];
    estimatedHours?: number;
    description?: string;
  };
  reminder?: {
    title: string;
    description?: string;
    remindAt: string;
  };
  sprint?: {
    name: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
    tasks?: Array<{
      title: string;
      priority?: Priority;
      estimatedHours?: number;
    }>;
  };
  summary?: string;
  message?: string;
}

export { TaskStatus, Priority, SprintStatus, ActivityType };
