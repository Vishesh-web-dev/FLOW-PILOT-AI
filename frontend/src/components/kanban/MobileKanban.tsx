import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Spin } from "antd";
import { Plus, RefreshCw } from "lucide-react";
import { tasksApi } from "../../api/tasks.api";
import { Task, TaskStatus } from "../../types";
import { KANBAN_COLUMNS, getPriorityConfig, getStatusConfig } from "../../utils/helpers";
import TaskModal from "./TaskModal";

interface MobileKanbanProps {
  projectIds?: string;   // comma-separated
  sprintIds?: string;    // comma-separated
  noSprintOnly?: boolean;
  noProjectOnly?: boolean;
}

export default function MobileKanban({ projectIds, sprintIds, noSprintOnly, noProjectOnly }: MobileKanbanProps) {
  const [activeCol, setActiveCol] = useState<TaskStatus>("TODO");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("TODO");

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
  const colTasks = tasks.filter((t) => t.status === activeCol);
  const activeColMeta = KANBAN_COLUMNS.find((c) => c.id === activeCol)!;

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Column Tabs */}
      <div
        style={{
          display: "flex",
          overflowX: "auto",
          gap: 8,
          paddingBottom: 4,
          scrollbarWidth: "none",
        }}
      >
        {KANBAN_COLUMNS.map((col) => {
          const count = tasks.filter((t) => t.status === col.id).length;
          const isActive = col.id === activeCol;
          return (
            <button
              key={col.id}
              onClick={() => setActiveCol(col.id as TaskStatus)}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 20,
                border: isActive ? `1px solid ${col.color}` : "1px solid #2a2a3a",
                background: isActive ? `${col.color}18` : "transparent",
                color: isActive ? col.color : "#64748b",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              {col.title}
              <span
                style={{
                  background: isActive ? col.color : "#2a2a3a",
                  color: isActive ? "#fff" : "#64748b",
                  borderRadius: 10,
                  padding: "1px 7px",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Actions row */}
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          {colTasks.length} task{colTasks.length !== 1 ? "s" : ""} in{" "}
          <span style={{ color: activeColMeta.color }}>{activeColMeta.title}</span>
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            size="small"
            icon={<RefreshCw size={12} />}
            onClick={() => refetch()}
            style={{ background: "#1c1c28", border: "1px solid #2a2a3a", color: "#64748b" }}
          />
          <Button
            type="primary"
            size="small"
            icon={<Plus size={12} />}
            onClick={() => {
              setEditingTask(null);
              setDefaultStatus(activeCol);
              setShowTaskModal(true);
            }}
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
            }}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Task List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {colTasks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "#475569",
              border: "1px dashed #2a2a3a",
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🗂️</div>
            <p style={{ margin: 0, fontSize: 14 }}>No tasks in {activeColMeta.title}</p>
          </div>
        ) : (
          colTasks.map((task) => {
            const priority = getPriorityConfig(task.priority);
            const status = getStatusConfig(task.status);
            const isOverdue =
              task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date();

            return (
              <div
                key={task.id}
                onClick={() => {
                  setEditingTask(task);
                  setDefaultStatus(task.status);
                  setShowTaskModal(true);
                }}
                style={{
                  background: "#16161d",
                  border: "1px solid #1e1e2a",
                  borderLeft: `3px solid ${priority.color}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  transition: "border-color 0.15s ease",
                }}
              >
                {/* Title + Priority */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0", lineHeight: 1.4 }}>
                    {task.title}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 7px",
                      borderRadius: 6,
                      background: `${priority.color}18`,
                      color: priority.color,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {priority.label}
                  </span>
                </div>

                {/* Description */}
                {task.description && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "#475569",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {task.description}
                  </p>
                )}

                {/* Footer: due date + assignee */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {task.dueDate && (
                    <span
                      style={{
                        fontSize: 11,
                        color: isOverdue ? "#ef4444" : "#64748b",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      📅{" "}
                      {new Date(task.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                  {task.assignee && (
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      👤 {task.assignee.name}
                    </span>
                  )}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      padding: "1px 7px",
                      borderRadius: 6,
                      background: `${status.color}18`,
                      color: status.color,
                    }}
                  >
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <TaskModal
        open={showTaskModal}
        task={editingTask}
        defaultStatus={defaultStatus}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
          // socket events task:created/task:updated handle cache invalidation
        }}
      />
    </div>
  );
}
