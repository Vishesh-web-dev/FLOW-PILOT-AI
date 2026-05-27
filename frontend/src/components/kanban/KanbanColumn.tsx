import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Badge, Button } from "antd";
import { Plus } from "lucide-react";
import { KanbanColumn } from "../../types";
import TaskCard from "./TaskCard";
import { Task } from "../../types";

interface KanbanColumnProps {
  column: KanbanColumn;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
}

export default function KanbanColumnComponent({
  column,
  onAddTask,
  onEditTask,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        minHeight: 200,
      }}
    >
      {/* Column Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "#16161d",
          borderRadius: "10px 10px 0 0",
          border: "1px solid #1e1e2a",
          borderBottom: `2px solid ${column.color}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: column.color,
              boxShadow: `0 0 6px ${column.color}80`,
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#e2e8f0",
            }}
          >
            {column.title}
          </span>
          <Badge
            count={column.tasks.length}
            style={{
              background: `${column.color}20`,
              color: column.color,
              boxShadow: "none",
              fontSize: 11,
              fontWeight: 600,
              border: `1px solid ${column.color}40`,
            }}
          />
        </div>
        <Button
          type="text"
          size="small"
          icon={<Plus size={14} />}
          onClick={onAddTask}
          style={{ color: "#475569", padding: "2px 6px" }}
        />
      </div>

      {/* Tasks Drop Zone */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: 120,
          padding: 8,
          background: isOver ? `${column.color}08` : "#111118",
          border: `1px solid ${isOver ? column.color + "40" : "#1e1e2a"}`,
          borderTop: "none",
          borderRadius: "0 0 10px 10px",
          transition: "all 0.15s ease",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <SortableContext
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => onEditTask(task)}
            />
          ))}
        </SortableContext>

        {column.tasks.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 16px",
              color: "#2a2a3a",
              fontSize: 12,
              gap: 8,
              flex: 1,
            }}
          >
            <div style={{ fontSize: 24 }}>○</div>
            <span>Drop tasks here</span>
          </div>
        )}

        {/* Add task button */}
        <button
          onClick={onAddTask}
          style={{
            background: "none",
            border: "1px dashed #2a2a3a",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: "pointer",
            color: "#3b4060",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "all 0.15s ease",
            marginTop: "auto",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = column.color + "60";
            (e.currentTarget as HTMLElement).style.color = column.color;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#2a2a3a";
            (e.currentTarget as HTMLElement).style.color = "#3b4060";
          }}
        >
          <Plus size={12} />
          Add task
        </button>
      </div>
    </div>
  );
}
