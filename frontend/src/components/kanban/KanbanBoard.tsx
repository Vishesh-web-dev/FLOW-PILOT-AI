import { useState, useCallback, useEffect, useRef } from "react";
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
import { arrayMove } from "@dnd-kit/sortable";
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

interface KanbanBoardProps {
  projectIds?: string;
  sprintIds?: string;
  noSprintOnly?: boolean;
  noProjectOnly?: boolean;
}

// Map of status → Task[] used as local drag state
type ColumnMap = Record<string, Task[]>;

function buildColumnMap(tasks: Task[]): ColumnMap {
  const map: ColumnMap = {};
  for (const col of KANBAN_COLUMNS) {
    map[col.id] = tasks
      .filter((t) => t.status === col.id)
      .sort((a, b) => a.position - b.position);
  }
  return map;
}

/** Find which column (by status key) contains a given task id */
function findContainer(columnMap: ColumnMap, taskId: string): string | null {
  for (const [colId, tasks] of Object.entries(columnMap)) {
    if (tasks.some((t) => t.id === taskId)) return colId;
  }
  return null;
}

export default function KanbanBoard({ projectIds, sprintIds, noSprintOnly, noProjectOnly }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("TODO");

  // Local column map — drives visual state during drag
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  // Track whether we're currently dragging (don't sync from server during drag)
  const isDraggingRef = useRef(false);
  // Track which column the drag started from (handleDragOver moves the task
  // into the destination column in local state, so we can't use findContainer
  // in handleDragEnd to determine the original column)
  const dragStartContainerRef = useRef<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tasks", { projectIds, sprintIds, noSprintOnly, noProjectOnly }],
    queryFn: () =>
      tasksApi.getAll({
        ...(projectIds && { projectIds }),
        ...(sprintIds && { sprintIds }),
        ...(noSprintOnly && { sprintId: "null" }),
        ...(noProjectOnly && { projectId: "null" }),
      }),
  });

  const tasks: Task[] = data?.data?.data || [];

  // Sync local state from server whenever server data changes AND we're not dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setColumnMap(buildColumnMap(tasks));
    }
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const reorderMutation = useMutation({
    mutationFn: tasksApi.reorder,
    onError: () => {
      // On error, revert to server data
      setColumnMap(buildColumnMap(tasks));
      toast.error("Failed to reorder tasks");
    },
  });

  // Build columns for render from local columnMap
  const columns: KanbanColumn[] = KANBAN_COLUMNS.map((col) => ({
    ...col,
    tasks: columnMap[col.id] ?? [],
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      isDraggingRef.current = true;
      const allLocalTasks = Object.values(columnMap).flat();
      const task = allLocalTasks.find((t) => t.id === event.active.id);
      if (task) {
        setActiveTask(task);
        // Record the original column BEFORE handleDragOver can move it
        dragStartContainerRef.current = findContainer(columnMap, task.id);
      }
    },
    [columnMap]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeContainer = findContainer(columnMap, activeId);
      if (!activeContainer) return;

      // overId is either a column id or a task id
      const isOverColumn = KANBAN_COLUMNS.some((col) => col.id === overId);
      const overContainer = isOverColumn
        ? overId
        : findContainer(columnMap, overId);

      if (!overContainer || activeContainer === overContainer) return;

      // ── Moving to a different column ──────────────────────────────────────
      setColumnMap((prev) => {
        const sourceItems = [...(prev[activeContainer] ?? [])];
        const destItems = [...(prev[overContainer] ?? [])];

        const activeIndex = sourceItems.findIndex((t) => t.id === activeId);
        if (activeIndex === -1) return prev;

        const movedTask = { ...sourceItems[activeIndex], status: overContainer as TaskStatus };

        // Remove from source
        sourceItems.splice(activeIndex, 1);

        // Insert into destination at the right position
        let destIndex: number;
        if (isOverColumn) {
          // Dropped on column header/empty area — append
          destIndex = destItems.length;
        } else {
          destIndex = destItems.findIndex((t) => t.id === overId);
          if (destIndex === -1) destIndex = destItems.length;
        }
        destItems.splice(destIndex, 0, movedTask);

        return {
          ...prev,
          [activeContainer]: sourceItems,
          [overContainer]: destItems,
        };
      });
    },
    [columnMap]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      isDraggingRef.current = false;
      setActiveTask(null);

      const { active, over } = event;
      if (!over) {
        setColumnMap(buildColumnMap(tasks));
        dragStartContainerRef.current = null;
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      // originalContainer = where drag started (before handleDragOver moved it)
      const originalContainer = dragStartContainerRef.current;
      dragStartContainerRef.current = null;

      if (!originalContainer) return;

      const isOverColumn = KANBAN_COLUMNS.some((col) => col.id === overId);
      // overContainer = where it was dropped
      const overContainer = isOverColumn
        ? overId
        : findContainer(columnMap, overId) ?? originalContainer;

      if (originalContainer === overContainer) {
        // ── Same-column reorder ───────────────────────────────────────────
        // columnMap already has correct order from handleDragOver for same-col,
        // but for same-col handleDragOver does nothing (early return),
        // so we compute it here with arrayMove.
        const sourceItems = [...(columnMap[overContainer] ?? [])];
        const activeIndex = sourceItems.findIndex((t) => t.id === activeId);
        const overIndex = isOverColumn
          ? sourceItems.length - 1
          : sourceItems.findIndex((t) => t.id === overId);

        if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return;

        const reordered = arrayMove(sourceItems, activeIndex, overIndex);
        setColumnMap((prev) => ({ ...prev, [overContainer]: reordered }));

        reorderMutation.mutate({
          tasks: reordered.map((t, idx) => ({
            id: t.id,
            status: overContainer as TaskStatus,
            position: idx,
          })),
        });
      } else {
        // ── Cross-column drop ─────────────────────────────────────────────
        // handleDragOver already moved the task into overContainer in columnMap.
        // Just read the final state and persist it.
        const destItems = columnMap[overContainer] ?? [];

        reorderMutation.mutate({
          tasks: destItems.map((t, idx) => ({
            id: t.id,
            status: overContainer as TaskStatus,
            position: idx,
          })),
        });
      }
    },
    [columnMap, tasks, reorderMutation]
  );

  const handleDragCancel = useCallback(() => {
    isDraggingRef.current = false;
    dragStartContainerRef.current = null;
    setActiveTask(null);
    setColumnMap(buildColumnMap(tasks));
  }, [tasks]);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Board Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
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
            style={{ background: "#1c1c28", border: "1px solid #2a2a3a", color: "#64748b" }}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<Plus size={12} />}
            onClick={() => handleAddTask("TODO")}
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none" }}
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
        onDragCancel={handleDragCancel}
      >
        <div
          className="kanban-grid"
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

        <DragOverlay>
          {activeTask && (
            <div style={{ transform: "rotate(2deg)", opacity: 0.92, pointerEvents: "none" }}>
              <TaskCard task={activeTask} isDragging onEdit={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskModal
        open={showTaskModal}
        task={editingTask}
        defaultStatus={defaultStatus}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
        }}
      />
    </div>
  );
}
