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

    // ── activity:new ─────────────────────────────────────────────────────────
    // Only mark stale — ai:action_executed does the actual refetch for AI flows.
    // For non-AI activity events the query becomes stale and refetches on next focus.
    socketRef.current.on("activity:new", () => {
      queryClient.invalidateQueries({ queryKey: ["activities"], refetchType: "none" });
    });

    // ── reminder:due ─────────────────────────────────────────────────────────
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
              <button onClick={() => toast.dismiss(t.id)} className="mt-1 text-xs text-primary-400">
                Dismiss
              </button>
            </div>
          </div>
        ),
        { duration: 10000, style: { background: "#16161d", border: "1px solid #6366f1", color: "#fff" } }
      );
      queryClient.invalidateQueries({ queryKey: ["reminders"]});
    });

    // ── ai:action_executed ────────────────────────────────────────────────────
    // task:created/updated/deleted events already fire for AI task mutations and
    // handle tasks + task-stats. We only need to trigger the activity refetch here
    // because activity:new uses refetchType:"none" to avoid N calls per AI command.
    socketRef.current.on("ai:action_executed", ({ result }: { command: string; result: AIActionResult; executed: Record<string, unknown> }) => {
      const type = result.type;
      // Single activity refetch (activity:new fires N times but uses "none")
      queryClient.invalidateQueries({ queryKey: ["activities"]});
      if (type === "CREATE_SPRINT" || type === "MOVE_TASKS_TO_SPRINT") {
        queryClient.invalidateQueries({ queryKey: ["sprints"]});
      }
      if (type === "CREATE_REMINDER") {
        queryClient.invalidateQueries({ queryKey: ["reminders"]});
      }
    });

    // ── task:created / task:updated / task:deleted ───────────────────────────
    // Use refetchType:"active" so any mounted query refetches immediately.
    // This handles both manual CRUD and AI-triggered mutations correctly.
    // AI commands fire one task:* event per task — for a single task this is 1 call,
    // which is acceptable. activity:new uses "none" to avoid N activity calls.
    const invalidateTasksActive = () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"]});
      queryClient.invalidateQueries({ queryKey: ["task-stats"]});
    };
    socketRef.current.on("task:created", invalidateTasksActive);
    socketRef.current.on("task:updated", invalidateTasksActive);
    socketRef.current.on("task:deleted", invalidateTasksActive);

    // ── tasks:reordered ───────────────────────────────────────────────────────
    // KanbanBoard already has optimistic local state for its own drag-drop.
    // We still mark tasks stale so other open tabs/windows refetch.
    // refetchType:"active" means only tabs that are actively showing this query refetch.
    socketRef.current.on("tasks:reordered", () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"]});
    });

    // ── task:assigned_to_you ─────────────────────────────────────────────────
    socketRef.current.on("task:assigned_to_you", (task) => {
      toast.success(`📌 You were assigned to "${(task as { title: string }).title}"`, {
        duration: 6000,
        style: { background: "#16161d", border: "1px solid #6366f1", color: "#fff" },
      });
      // task:updated will also fire and handle the cache invalidation
    });

    // ── project:updated / deleted ────────────────────────────────────────────
    socketRef.current.on("project:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["projects"]});
    });
    socketRef.current.on("project:deleted", () => {
      queryClient.invalidateQueries({ queryKey: ["projects"]});
    });

    // ── project:member_joined / removed / role_changed ───────────────────────
    socketRef.current.on("project:member_joined", (data) => {
      const d = data as { member: { user: { name: string } }; projectId: string };
      queryClient.invalidateQueries({ queryKey: ["projects"]});
      queryClient.invalidateQueries({ queryKey: ["team-members", d.projectId]});
      toast.success(`👥 ${d.member.user.name} joined the project`, {
        style: { background: "#16161d", border: "1px solid #22c55e", color: "#fff" },
      });
    });
    socketRef.current.on("project:member_removed", (data) => {
      const d = data as { userId: string; projectId: string };
      queryClient.invalidateQueries({ queryKey: ["projects"]});
      queryClient.invalidateQueries({ queryKey: ["team-members", d.projectId]});
    });
    socketRef.current.on("project:member_role_changed", (data) => {
      const d = data as { projectId: string };
      queryClient.invalidateQueries({ queryKey: ["team-members", d.projectId]});
      queryClient.invalidateQueries({ queryKey: ["projects"]});
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
        { duration: 10000, style: { background: "#16161d", border: "1px solid #6366f1", color: "#fff" } }
      );
      queryClient.invalidateQueries({ queryKey: ["my-invites"]});
    });

    // ── project:removed_from_project ─────────────────────────────────────────
    socketRef.current.on("project:removed_from_project", () => {
      queryClient.invalidateQueries({ queryKey: ["projects"]});
      toast.error("You were removed from a project", {
        style: { background: "#16161d", border: "1px solid #ef4444", color: "#fff" },
      });
    });

    // ── sprint:created / updated / deleted ───────────────────────────────────
    const invalidateSprintsActive = () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"]});
    };
    socketRef.current.on("sprint:created", invalidateSprintsActive);
    socketRef.current.on("sprint:updated", invalidateSprintsActive);
    socketRef.current.on("sprint:deleted", invalidateSprintsActive);

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
