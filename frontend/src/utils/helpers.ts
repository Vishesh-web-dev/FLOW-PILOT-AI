import { Priority, TaskStatus, ActivityType } from "../types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const getPriorityConfig = (priority: Priority) => {
  const config = {
    LOW: {
      label: "Low",
      color: "#6b7280",
      bg: "rgba(107, 114, 128, 0.15)",
      border: "rgba(107, 114, 128, 0.3)",
      dot: "#6b7280",
    },
    MEDIUM: {
      label: "Medium",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.15)",
      border: "rgba(245, 158, 11, 0.3)",
      dot: "#f59e0b",
    },
    HIGH: {
      label: "High",
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.15)",
      border: "rgba(239, 68, 68, 0.3)",
      dot: "#ef4444",
    },
    URGENT: {
      label: "Urgent",
      color: "#dc2626",
      bg: "rgba(220, 38, 38, 0.2)",
      border: "rgba(220, 38, 38, 0.5)",
      dot: "#dc2626",
    },
  };
  return config[priority] || config.MEDIUM;
};

export const getStatusConfig = (status: TaskStatus) => {
  const config = {
    TODO: {
      label: "To Do",
      color: "#6b7280",
      bg: "rgba(107, 114, 128, 0.1)",
      icon: "○",
    },
    IN_PROGRESS: {
      label: "In Progress",
      color: "#6366f1",
      bg: "rgba(99, 102, 241, 0.1)",
      icon: "◐",
    },
    IN_REVIEW: {
      label: "In Review",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.1)",
      icon: "◑",
    },
    DONE: {
      label: "Done",
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.1)",
      icon: "●",
    },
  };
  return config[status] || config.TODO;
};

export const getActivityIcon = (type: ActivityType): string => {
  const icons: Record<ActivityType, string> = {
    TASK_CREATED: "✅",
    TASK_UPDATED: "✏️",
    TASK_DELETED: "🗑️",
    TASK_MOVED: "🔀",
    SPRINT_CREATED: "🏃",
    SPRINT_UPDATED: "🔄",
    AI_COMMAND: "🤖",
    REMINDER_SET: "⏰",
    PROJECT_CREATED: "📁",
    USER_REGISTERED: "👋",
  };
  return icons[type] || "📝";
};

export const getActivityColor = (type: ActivityType): string => {
  const colors: Record<ActivityType, string> = {
    TASK_CREATED: "#10b981",
    TASK_UPDATED: "#6366f1",
    TASK_DELETED: "#ef4444",
    TASK_MOVED: "#f59e0b",
    SPRINT_CREATED: "#8b5cf6",
    SPRINT_UPDATED: "#06b6d4",
    AI_COMMAND: "#6366f1",
    REMINDER_SET: "#f59e0b",
    PROJECT_CREATED: "#10b981",
    USER_REGISTERED: "#06b6d4",
  };
  return colors[type] || "#6b7280";
};

export const formatRelativeTime = (date: string | Date): string => {
  return dayjs(date).fromNow();
};

export const formatDate = (date: string | Date, format = "MMM D, YYYY"): string => {
  return dayjs(date).format(format);
};

export const formatDateTime = (date: string | Date): string => {
  return dayjs(date).format("MMM D, YYYY [at] h:mm A");
};

export const isOverdue = (dueDate: string | Date | null | undefined): boolean => {
  if (!dueDate) return false;
  return dayjs(dueDate).isBefore(dayjs(), "day");
};

export const isDueSoon = (dueDate: string | Date | null | undefined): boolean => {
  if (!dueDate) return false;
  const due = dayjs(dueDate);
  const now = dayjs();
  return due.isAfter(now) && due.diff(now, "day") <= 3;
};

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const truncate = (str: string, length: number): string => {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
};

export const KANBAN_COLUMNS: { id: TaskStatus; title: string; color: string; accent: string }[] = [
  { id: "TODO", title: "To Do", color: "#6b7280", accent: "rgba(107, 114, 128, 0.1)" },
  { id: "IN_PROGRESS", title: "In Progress", color: "#6366f1", accent: "rgba(99, 102, 241, 0.1)" },
  { id: "IN_REVIEW", title: "In Review", color: "#f59e0b", accent: "rgba(245, 158, 11, 0.1)" },
  { id: "DONE", title: "Done", color: "#10b981", accent: "rgba(16, 185, 129, 0.1)" },
];

export const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export const STATUS_OPTIONS = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "DONE", label: "Done" },
];

export const PROJECT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
];

export const AI_COMMAND_EXAMPLES = [
  "Create high priority task for payment bug fix",
  "Create 3 backend tasks for user authentication module",
  "Schedule frontend review meeting tomorrow at 3 PM",
  "Remind me to deploy on Friday at 5 PM",
  "Build authentication system — break it down into subtasks",
  "Create a 2-week sprint for the dashboard feature",
  "Summarize today's progress",
  "Create urgent task: fix database connection timeout",
];
