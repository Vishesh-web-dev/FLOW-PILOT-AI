// Task types
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type SprintStatus = "PLANNING" | "ACTIVE" | "COMPLETED";
export type ProjectRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type InviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
export type ActivityType =
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "TASK_MOVED"
  | "SPRINT_CREATED"
  | "SPRINT_UPDATED"
  | "AI_COMMAND"
  | "REMINDER_SET"
  | "PROJECT_CREATED"
  | "USER_REGISTERED"
  | "MEMBER_INVITED"
  | "MEMBER_JOINED"
  | "MEMBER_REMOVED"
  | "MEMBER_ROLE_CHANGED"
  | "SCHEDULE_CREATED"
  | "SCHEDULE_UPDATED"
  | "SCHEDULE_CHECKED";

export type ScheduleType = "DAILY" | "WEEKLY" | "MONTHLY";

export interface ScheduleItem {
  id: string;
  title: string;
  description?: string | null;
  timeOfDay?: string | null;
  category?: string | null;
  order: number;
  scheduleId: string;
  createdAt: string;
}

export interface ScheduleLog {
  id: string;
  date: string;
  isDone: boolean;
  note?: string | null;
  scheduleId: string;
  scheduleItemId: string;
  scheduleItem?: ScheduleItem;
}

export interface Schedule {
  id: string;
  name: string;
  description?: string | null;
  type: ScheduleType;
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  items: ScheduleItem[];
  _count?: { items: number; logs: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    tasks: number;
    projects: number;
    sprints: number;
  };
}

export interface ProjectMember {
  id: string;
  role: ProjectRole;
  joinedAt: string;
  userId: string;
  projectId: string;
  user: Pick<User, "id" | "name" | "email" | "avatar">;
}

export interface ProjectInvite {
  id: string;
  email: string;
  role: ProjectRole;
  status: InviteStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
  projectId: string;
  project?: Pick<Project, "id" | "name" | "color">;
  invitedById: string;
  invitedBy?: Pick<User, "id" | "name" | "avatar">;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  status?: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  userId: string;
  myRole?: ProjectRole;
  members?: ProjectMember[];
  _count?: {
    tasks: number;
    sprints: number;
    members: number;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  position: number;
  labels: string[];
  estimatedHours?: number | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  assigneeId?: string | null;
  assignee?: Pick<User, "id" | "name" | "avatar"> | null;
  projectId?: string | null;
  project?: Pick<Project, "id" | "name" | "color"> | null;
  sprintId?: string | null;
  sprint?: Pick<Sprint, "id" | "name"> | null;
  parentId?: string | null;
  parent?: Pick<Task, "id" | "title"> | null;
  subtasks?: SubTask[];
  _count?: { subtasks: number };
}

export interface SubTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
}

export interface Sprint {
  id: string;
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: SprintStatus;
  createdAt: string;
  updatedAt: string;
  userId: string;
  projectId?: string | null;
  project?: Pick<Project, "id" | "name" | "color"> | null;
  tasks?: Task[];
  _count?: { tasks: number };
  progress?: number;
  totalTasks?: number;
  completedTasks?: number;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string | null;
  remindAt: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  userId: string;
  taskId?: string | null;
  projectId?: string | null;
  task?: Pick<Task, "id" | "title" | "status" | "priority"> | null;
  project?: { id: string; name: string } | null;
  user: Pick<User, "id" | "name" | "avatar">;
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
    | "MOVE_TASKS_TO_SPRINT"
    | "COMPLETE_TASKS"
    | "UNKNOWN";
  tasks?: Array<{
    title: string;
    description?: string;
    priority?: Priority;
    dueDate?: string;
    labels?: string[];
    estimatedHours?: number;
  }>;
  // For status updates / delete by title
  taskTitles?: string[];
  taskTitle?: string;
  newStatus?: TaskStatus;
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

export interface AICommandResponse {
  aiResult: AIActionResult;
  executed: Record<string, unknown>;
  command: string;
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

export interface TaskStats {
  total: number;
  byStatus: Array<{ status: TaskStatus; _count: number }>;
  byPriority: Array<{ priority: Priority; _count: number }>;
  dueSoon: number;
  completedThisWeek: number;
}

export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  color: string;
  tasks: Task[];
}

// Form types
export interface CreateTaskForm {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  labels?: string[];
  estimatedHours?: number;
  projectId?: string;
  sprintId?: string;
  assigneeId?: string | null;
}

export interface CreateProjectForm {
  name: string;
  description?: string;
  color?: string;
}

export interface CreateSprintForm {
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}

// Socket event types
export interface SocketEvents {
  "activity:new": Activity;
  "task:created": Task;
  "task:updated": Task;
  "task:deleted": { id: string; projectId?: string };
  "task:assigned_to_you": Task;
  "tasks:reordered": Array<{ id: string; status: TaskStatus; position: number }>;
  "sprint:created": Sprint;
  "sprint:updated": Sprint;
  "sprint:deleted": { id: string; projectId?: string };
  "ai:action_executed": { command: string; result: AIActionResult; executed: Record<string, unknown> };
  "reminder:due": Pick<Reminder, "id" | "title" | "description" | "remindAt">;
  "project:updated": Project;
  "project:deleted": { id: string };
  "project:member_joined": { member: ProjectMember; projectId: string };
  "project:member_removed": { memberId: string; userId: string; projectId: string };
  "project:member_role_changed": { memberId: string; role: ProjectRole; projectId: string };
  "project:invite_received": { invite: { id: string; token: string; projectName: string; role: ProjectRole; invitedBy: string } };
  "project:removed_from_project": { projectId: string };
  pong: { timestamp: number };
}
