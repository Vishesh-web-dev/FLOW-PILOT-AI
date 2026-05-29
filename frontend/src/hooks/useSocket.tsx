import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { SocketEvents, AIActionResult } from "../types";
import toast from "react-hot-toast";

type SocketEvent = keyof SocketEvents;
type EventCallback<T extends SocketEvent> = (data: SocketEvents[T]) => void;

let socket: Socket | null = null;

export const getSocket = (): Socket | null => socket;

export const useSocket = () => {
  const { token, isAuthenticated } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket = socketRef.current;

    socketRef.current.on("connect", () => {
      console.log("✅ Socket connected:", socketRef.current?.id);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    // ── reminder:due ─────────────────────────────────────────────────────────
    // Server-push from cron job — user has no way to know without this.
    socketRef.current.on("reminder:due", (reminder) => {
      toast(
        (t) => (
          <div className="flex items-start gap-3">
            <div className="text-2xl">⏰</div>
            <div>
              <p className="font-semibold text-white">{reminder.title}</p>
              {reminder.description && (
                <p className="text-sm text-gray-400">{reminder.description}</p>
              )}
              <button
                onClick={() => toast.dismiss(t.id)}
                className="mt-1 text-xs text-primary-400"
              >
                Dismiss
              </button>
            </div>
          </div>
        ),
        {
          duration: 10000,
          style: {
            background: "#16161d",
            border: "1px solid #6366f1",
            color: "#fff",
          },
        }
      );
      // Refresh reminders list so the badge count updates
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    });

    // ── ai:action_executed ────────────────────────────────────────────────────
    // AI can mutate tasks, activities, sprints, reminders server-side.
    // Invalidate the right query keys so every open page stays in sync.
    socketRef.current.on("ai:action_executed", ({ result }: { command: string; result: AIActionResult; executed: Record<string, unknown> }) => {
      const type = result.type;

      // Tasks & stats need refresh for any task-mutating action
      const taskActions = [
        "CREATE_TASK", "CREATE_TASKS", "BREAKDOWN_TASK",
        "UPDATE_TASK_STATUS", "UPDATE_TASK", "COMPLETE_TASKS",
        "DELETE_TASK", "DELETE_TASKS", "MOVE_TASKS_TO_SPRINT",
      ];
      if (taskActions.includes(type)) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["task-stats"] });
      }

      // Activity feed always refreshes (AI logs every action)
      queryClient.invalidateQueries({ queryKey: ["activities"] });

      if (type === "CREATE_SPRINT") {
        queryClient.invalidateQueries({ queryKey: ["sprints"] });
      }
      if (type === "MOVE_TASKS_TO_SPRINT") {
        queryClient.invalidateQueries({ queryKey: ["sprints"] });
      }
      if (type === "CREATE_REMINDER") {
        queryClient.invalidateQueries({ queryKey: ["reminders"] });
      }
    });

    // ── task:created / updated / deleted from project rooms ─────────────────
    socketRef.current.on("task:created", () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
    });

    socketRef.current.on("task:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
    });

    socketRef.current.on("task:deleted", () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
    });

    // ── task:assigned_to_you ─────────────────────────────────────────────────
    socketRef.current.on("task:assigned_to_you", (task) => {
      toast.success(`📌 You were assigned to "${(task as { title: string }).title}"`, {
        duration: 6000,
        style: { background: "#16161d", border: "1px solid #6366f1", color: "#fff" },
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    });

    // ── project:updated / deleted ────────────────────────────────────────────
    socketRef.current.on("project:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    });

    socketRef.current.on("project:deleted", () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    });

    // ── project:member_joined ────────────────────────────────────────────────
    socketRef.current.on("project:member_joined", (data) => {
      const d = data as { member: { user: { name: string } }; projectId: string };
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["team-members", d.projectId] });
      toast.success(`👥 ${d.member.user.name} joined the project`, {
        style: { background: "#16161d", border: "1px solid #22c55e", color: "#fff" },
      });
    });

    // ── project:member_removed ───────────────────────────────────────────────
    socketRef.current.on("project:member_removed", (data) => {
      const d = data as { userId: string; projectId: string };
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["team-members", d.projectId] });
    });

    // ── project:member_role_changed ──────────────────────────────────────────
    socketRef.current.on("project:member_role_changed", (data) => {
      const d = data as { projectId: string };
      queryClient.invalidateQueries({ queryKey: ["team-members", d.projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    });

    // ── project:invite_received ──────────────────────────────────────────────
    socketRef.current.on("project:invite_received", (data) => {
      const d = data as { invite: { projectName: string; invitedBy: string } };
      toast(
        () => (
          <div>
            <p style={{ fontWeight: 600, color: "#fff", marginBottom: 4 }}>📨 Project Invitation</p>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>
              {d.invite.invitedBy} invited you to <strong>{d.invite.projectName}</strong>
            </p>
          </div>
        ),
        {
          duration: 10000,
          style: { background: "#16161d", border: "1px solid #6366f1", color: "#fff" },
        }
      );
      queryClient.invalidateQueries({ queryKey: ["my-invites"] });
    });

    // ── project:removed_from_project ─────────────────────────────────────────
    socketRef.current.on("project:removed_from_project", () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.error("You were removed from a project", {
        style: { background: "#16161d", border: "1px solid #ef4444", color: "#fff" },
      });
    });

    return () => {
      socketRef.current?.disconnect();
      socket = null;
    };
  }, [isAuthenticated, token, queryClient]);

  const on = <T extends SocketEvent>(event: T, callback: EventCallback<T>) => {
    socketRef.current?.on(event as string, callback as (...args: unknown[]) => void);
  };

  const off = <T extends SocketEvent>(event: T, callback?: EventCallback<T>) => {
    socketRef.current?.off(event as string, callback as (...args: unknown[]) => void);
  };

  const emit = (event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  };

  return {
    socket: socketRef.current,
    on,
    off,
    emit,
    isConnected: socketRef.current?.connected ?? false,
  };
};
