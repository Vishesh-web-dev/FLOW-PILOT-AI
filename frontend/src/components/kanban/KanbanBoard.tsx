import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Spin } from "antd";
import { Plus, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { tasksApi } from "../../api/tasks.api";
import { Task, TaskStatus, KanbanColumn } from "../../types";
import { KANBAN_COLUMNS } from "../../utils/helpers";
import KanbanColumnComponent from "./KanbanColumn";
import TaskCard from "./TaskCard";
import TaskModal from "./TaskModal";
import { getSocket } from "../../hooks/useSocket";

interface KanbanBoardProps {
  projectId?: string;
  sprintId?: string;
}

export default function KanbanBoard({ projectId, sprintId }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("TODO");

  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tasks", { projectId, sprintId }],
    queryFn: () =>
      tasksApi.getAll({
        ...(projectId && { projectId }),
        ...(sprintId && { sprintId }),
      }),
  });

  const tasks: Task[] = data?.data?.data || [];

  // ── Join / leave project socket room ──────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    const sock = getSocket();
    if (!sock) return;

    sock.emit("join:project", projectId);

    // Real-time: invalidate tasks query when anyone changes something
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", { projectId, sprintId }] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
    };

    sock.on("task:created", invalidate);
    sock.on("task:updated", invalidate);
    sock.on("task:deleted", invalidate);
    sock.on("tasks:reordered", invalidate);

    return () => {
      sock.emit("leave:project", projectId);
      sock.off("task:created", invalidate);
      sock.off("task:updated", invalidate);
      sock.off("task:deleted", invalidate);
      sock.off("tasks:reordered", invalidate);
    };
  }, [projectId, sprintId, queryClient]);

  const reorderMutation = useMutation({
    mutationFn: tasksApi.reorder,
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.error("Failed to reorder tasks");
    },
  });

  // Build Kanban columns
  const columns: KanbanColumn[] = KANBAN_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks
      .filter((t) => t.status === col.id)
      .sort((a, b) => a.position - b.position),
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      if (task) setActiveTask(task);
    },
    [tasks]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeTaskId = active.id as string;
      const overId = over.id as string;

      const activeTask = tasks.find((t) => t.id === activeTaskId);
      if (!activeTask) return;

      // Check if over a column
      const isOverColumn = KANBAN_COLUMNS.some((col) => col.id === overId);
      if (isOverColumn && activeTask.status !== overId) {
        // Optimistic update - update locally
        queryClient.setQueryData(
          ["tasks", { projectId, sprintId }],
          (old: typeof data) => {
            if (!old?.data?.data) return old;
            return {
              ...old,
              data: {
                ...old.data,
                data: old.data.data.map((t: Task) =>
                  t.id === activeTaskId ? { ...t, status: overId as TaskStatus } : t
                ),
              },
            };
          }
        );
      }
    },
    [tasks, queryClient, projectId, sprintId, data]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const activeTaskId = active.id as string;
      const overId = over.id as string;

      const activeTaskItem = tasks.find((t) => t.id === activeTaskId);
      if (!activeTaskItem) return;

      // Determine target status
      let targetStatus: TaskStatus = activeTaskItem.status;
      const isOverColumn = KANBAN_COLUMNS.some((col) => col.id === overId);
      const overTask = tasks.find((t) => t.id === overId);

      if (isOverColumn) {
        targetStatus = overId as TaskStatus;
      } else if (overTask) {
        targetStatus = overTask.status;
      }

      // Build reordered tasks for the target column
      const columnTasks = tasks
        .filter((t) => t.status === targetStatus)
        .sort((a, b) => a.position - b.position);

      const activeIndex = columnTasks.findIndex((t) => t.id === activeTaskId);
      const overIndex = overTask
        ? columnTasks.findIndex((t) => t.id === overId)
        : columnTasks.length;

      let newColumnTasks = [...columnTasks];
      if (activeTaskItem.status === targetStatus) {
        // Same column reorder
        newColumnTasks.splice(activeIndex, 1);
        newColumnTasks.splice(Math.max(0, overIndex), 0, { ...activeTaskItem, status: targetStatus });
      } else {
        // Moving to different column
        newColumnTasks.splice(Math.max(0, overIndex), 0, { ...activeTaskItem, status: targetStatus });
      }

      const reorderPayload = newColumnTasks.map((t, idx) => ({
        id: t.id,
        status: targetStatus,
        position: idx,
      }));

      reorderMutation.mutate({ tasks: reorderPayload });
    },
    [tasks, reorderMutation]
  );

  const handleAddTask = (status: TaskStatus) => {
    setDefaultStatus(status);
    setEditingTask(null);
    setShowTaskModal(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 400,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Board Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#64748b" }}>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </span>
          <span style={{ color: "#2a2a3a" }}>•</span>
          <span style={{ fontSize: 14, color: "#10b981" }}>
            {tasks.filter((t) => t.status === "DONE").length} completed
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="small"
            icon={<RefreshCw size={12} />}
            onClick={() => refetch()}
            style={{
              background: "#1c1c28",
              border: "1px solid #2a2a3a",
              color: "#64748b",
            }}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<Plus size={12} />}
            onClick={() => handleAddTask("TODO")}
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
            }}
          >
            Add Task
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            alignItems: "start",
            minHeight: 500,
          }}
        >
          {columns.map((column) => (
            <KanbanColumnComponent
              key={column.id}
              column={column}
              onAddTask={() => handleAddTask(column.id)}
              onEditTask={handleEditTask}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask && (
            <div style={{ transform: "rotate(3deg)", opacity: 0.9 }}>
              <TaskCard
                task={activeTask}
                isDragging
                onEdit={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Task Modal */}
      <TaskModal
        open={showTaskModal}
        task={editingTask}
        defaultStatus={defaultStatus}
        projectId={projectId}
        sprintId={sprintId}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
        }}
      />
    </div>
  );
}
