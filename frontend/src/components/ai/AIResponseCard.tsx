import { Tag } from "antd";
import { CheckCircle, ListTodo, Bell, Zap, BookOpen, X, Layers } from "lucide-react";
import { AICommandResponse, Priority } from "../../types";
import { getPriorityConfig, formatDate } from "../../utils/helpers";

interface AIResponseCardProps {
  response: AICommandResponse;
  onDismiss?: () => void;
}

const ACTION_CONFIG = {
  CREATE_TASK: { icon: <ListTodo size={16} />, label: "Task Created", color: "#10b981" },
  CREATE_TASKS: { icon: <ListTodo size={16} />, label: "Tasks Created", color: "#10b981" },
  BREAKDOWN_TASK: { icon: <Layers size={16} />, label: "Task Breakdown", color: "#6366f1" },
  CREATE_REMINDER: { icon: <Bell size={16} />, label: "Reminder Set", color: "#f59e0b" },
  SUMMARIZE: { icon: <BookOpen size={16} />, label: "Summary", color: "#06b6d4" },
  CREATE_SPRINT: { icon: <Zap size={16} />, label: "Sprint Created", color: "#8b5cf6" },
  SCHEDULE_EVENT: { icon: <CheckCircle size={16} />, label: "Event Scheduled", color: "#10b981" },
  UPDATE_TASK_STATUS: { icon: <CheckCircle size={16} />, label: "Task Status Updated", color: "#6366f1" },
  UPDATE_TASK: { icon: <CheckCircle size={16} />, label: "Task Updated", color: "#6366f1" },
  DELETE_TASK: { icon: <X size={16} />, label: "Task Deleted", color: "#ef4444" },
  DELETE_TASKS: { icon: <X size={16} />, label: "Tasks Deleted", color: "#ef4444" },
  MOVE_TASKS_TO_SPRINT: { icon: <Zap size={16} />, label: "Tasks Moved to Sprint", color: "#8b5cf6" },
  COMPLETE_TASKS: { icon: <CheckCircle size={16} />, label: "Tasks Completed", color: "#10b981" },
  UNKNOWN: { icon: <BookOpen size={16} />, label: "Response", color: "#6b7280" },
};

export default function AIResponseCard({ response, onDismiss }: AIResponseCardProps) {
  const { aiResult, executed } = response;
  const config = ACTION_CONFIG[aiResult.type] || ACTION_CONFIG.UNKNOWN;

  return (
    <div
      className="animate-fade-in-up"
      style={{
        background: "#16161d",
        border: `1px solid ${config.color}30`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: `${config.color}10`,
          borderBottom: `1px solid ${config.color}20`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: config.color }}>{config.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: config.color }}>
            {config.label}
          </span>
          <span style={{ fontSize: 12, color: "#475569" }}>— {aiResult.message}</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#475569",
              display: "flex",
              padding: 4,
              borderRadius: 4,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "12px 16px" }}>
        {/* Tasks result */}
        {aiResult.tasks && aiResult.tasks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {aiResult.tasks.map((task, i) => {
              const priorityConf = getPriorityConfig(task.priority || ("MEDIUM" as Priority));
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    background: "#1c1c28",
                    borderRadius: 8,
                    border: "1px solid #2a2a3a",
                  }}
                >
                  <div
                    className="priority-dot"
                    style={{ background: priorityConf.dot }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>
                    {task.title}
                  </span>
                  <Tag
                    style={{
                      background: priorityConf.bg,
                      border: `1px solid ${priorityConf.border}`,
                      color: priorityConf.color,
                      borderRadius: 4,
                      fontSize: 11,
                      margin: 0,
                    }}
                  >
                    {task.priority || "MEDIUM"}
                  </Tag>
                  {task.dueDate && (
                    <span style={{ fontSize: 11, color: "#475569" }}>
                      Due: {formatDate(task.dueDate)}
                    </span>
                  )}
                  {task.estimatedHours && (
                    <span style={{ fontSize: 11, color: "#475569" }}>
                      ~{task.estimatedHours}h
                    </span>
                  )}
                </div>
              );
            })}

            <div style={{ fontSize: 12, color: "#10b981", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle size={12} />
              {(executed as any)?.created || aiResult.tasks.length} task
              {((executed as any)?.created || aiResult.tasks.length) > 1 ? "s" : ""} added to your board
            </div>
          </div>
        )}

        {/* Reminder result */}
        {aiResult.reminder && (
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(245, 158, 11, 0.08)",
              borderRadius: 8,
              border: "1px solid rgba(245, 158, 11, 0.2)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24" }}>
              ⏰ {aiResult.reminder.title}
            </div>
            {aiResult.reminder.description && (
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                {aiResult.reminder.description}
              </div>
            )}
            <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 4 }}>
              Reminder at: {formatDate(aiResult.reminder.remindAt, "MMM D, YYYY [at] h:mm A")}
            </div>
          </div>
        )}

        {/* Sprint result */}
        {aiResult.sprint && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                padding: "10px 12px",
                background: "rgba(139, 92, 246, 0.08)",
                borderRadius: 8,
                border: "1px solid rgba(139, 92, 246, 0.2)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "#c4b5fd" }}>
                ⚡ {aiResult.sprint.name}
              </div>
              {aiResult.sprint.goal && (
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                  Goal: {aiResult.sprint.goal}
                </div>
              )}
              {(aiResult.sprint.tasks?.length ?? 0) > 0 && (
                <div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 4 }}>
                  {aiResult.sprint.tasks?.length} tasks planned
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary result */}
        {aiResult.summary && (
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(6, 182, 212, 0.08)",
              borderRadius: 8,
              border: "1px solid rgba(6, 182, 212, 0.2)",
              fontSize: 14,
              color: "#e2e8f0",
              lineHeight: 1.6,
            }}
          >
            {aiResult.summary}
          </div>
        )}
      </div>
    </div>
  );
}
