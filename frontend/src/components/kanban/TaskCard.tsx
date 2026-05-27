import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tag, Tooltip, Popconfirm } from "antd";
import { Calendar, Clock, Layers, GripVertical, Edit3, AlertCircle, Trash2 } from "lucide-react";
import { Task } from "../../types";
import {
  getPriorityConfig,
  getStatusConfig,
  formatDate,
  isOverdue,
  isDueSoon,
  truncate,
} from "../../utils/helpers";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks.api";
import toast from "react-hot-toast";

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  isDragging?: boolean;
}

export default function TaskCard({ task, onEdit, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  const priorityConfig = getPriorityConfig(task.priority);
  const overdue = isOverdue(task.dueDate);
  const dueSoon = isDueSoon(task.dueDate);
  const hasSubtasks = (task._count?.subtasks ?? 0) > 0 || (task.subtasks?.length ?? 0) > 0;
  const subtaskCount = task._count?.subtasks ?? task.subtasks?.length ?? 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.status === "DONE").length ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isDragging ? "#2a2a3a" : "#1c1c24",
        border: `1px solid ${isSortableDragging || isDragging ? priorityConfig.border : "#2a2a3a"}`,
        borderRadius: 10,
        padding: 12,
        cursor: "grab",
        transition: "all 0.15s ease",
        boxShadow: isDragging
          ? "0 20px 40px rgba(0,0,0,0.6)"
          : "0 2px 8px rgba(0,0,0,0.3)",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (!isSortableDragging) {
          (e.currentTarget as HTMLElement).style.borderColor = "#3a3a50";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.4)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSortableDragging) {
          (e.currentTarget as HTMLElement).style.borderColor = "#2a2a3a";
          (e.currentTarget as HTMLElement).style.transform = "none";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
        }
      }}
    >
      {/* Priority indicator line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: priorityConfig.color,
          borderRadius: "10px 0 0 10px",
        }}
      />

      {/* Top row: drag handle + priority + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          paddingLeft: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <div
            {...attributes}
            {...listeners}
            style={{
              color: "#3b4060",
              cursor: "grab",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <GripVertical size={14} />
          </div>
          <Tooltip title={task.title}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: task.status === "DONE" ? "#475569" : "#e2e8f0",
                textDecoration: task.status === "DONE" ? "line-through" : "none",
                lineHeight: 1.4,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {task.title}
            </span>
          </Tooltip>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {/* Edit button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#3b4060",
              padding: 4,
              borderRadius: 4,
              display: "flex",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#a5b4fc";
              (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#3b4060";
              (e.currentTarget as HTMLElement).style.background = "none";
            }}
            title="Edit task"
          >
            <Edit3 size={12} />
          </button>

          {/* Delete button */}
          <Popconfirm
            title={<span style={{ color: "#e2e8f0" }}>Delete this task?</span>}
            description={
              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                This action cannot be undone.
              </span>
            }
            onConfirm={(e) => {
              e?.stopPropagation();
              deleteMutation.mutate();
            }}
            onCancel={(e) => e?.stopPropagation()}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{
              danger: true,
              loading: deleteMutation.isPending,
              size: "small",
            }}
            cancelButtonProps={{ size: "small" }}
            overlayStyle={{ zIndex: 9999 }}
          >
            <button
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#3b4060",
                padding: 4,
                borderRadius: 4,
                display: "flex",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#f87171";
                (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#3b4060";
                (e.currentTarget as HTMLElement).style.background = "none";
              }}
              title="Delete task"
            >
              <Trash2 size={12} />
            </button>
          </Popconfirm>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p
          style={{
            fontSize: 12,
            color: "#475569",
            marginTop: 6,
            paddingLeft: 20,
            lineHeight: 1.5,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {task.description}
        </p>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginTop: 8,
            paddingLeft: 20,
          }}
        >
          {task.labels.slice(0, 3).map((label) => (
            <Tag
              key={label}
              style={{
                fontSize: 10,
                padding: "1px 6px",
                margin: 0,
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.2)",
                color: "#a5b4fc",
                borderRadius: 4,
              }}
            >
              {label}
            </Tag>
          ))}
          {task.labels.length > 3 && (
            <span style={{ fontSize: 10, color: "#475569" }}>+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
          paddingLeft: 20,
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {/* Priority */}
        <Tag
          style={{
            fontSize: 10,
            padding: "1px 6px",
            margin: 0,
            background: priorityConfig.bg,
            border: `1px solid ${priorityConfig.border}`,
            color: priorityConfig.color,
            borderRadius: 4,
          }}
        >
          {task.priority}
        </Tag>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
          }}
        >
          {/* Due date */}
          {task.dueDate && (
            <Tooltip title={`Due: ${formatDate(task.dueDate)}`}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  color: overdue ? "#ef4444" : dueSoon ? "#f59e0b" : "#475569",
                  fontSize: 11,
                }}
              >
                {overdue ? (
                  <AlertCircle size={10} />
                ) : (
                  <Calendar size={10} />
                )}
                {formatDate(task.dueDate, "MMM D")}
              </div>
            </Tooltip>
          )}

          {/* Estimated hours */}
          {task.estimatedHours && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                color: "#475569",
                fontSize: 11,
              }}
            >
              <Clock size={10} />
              {task.estimatedHours}h
            </div>
          )}

          {/* Subtasks */}
          {hasSubtasks && (
            <Tooltip title={`${completedSubtasks}/${subtaskCount} subtasks done`}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  color: completedSubtasks === subtaskCount ? "#10b981" : "#475569",
                  fontSize: 11,
                }}
              >
                <Layers size={10} />
                {completedSubtasks}/{subtaskCount}
              </div>
            </Tooltip>
          )}

          {/* Project badge */}
          {task.project && (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: task.project.color,
                flexShrink: 0,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
