import KanbanBoard from "../components/kanban/KanbanBoard";
import AICommandInput from "../components/ai/AICommandInput";
import { useQueryClient } from "@tanstack/react-query";

export default function KanbanPage() {
  const queryClient = useQueryClient();

  return (
    <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            background: "linear-gradient(135deg, #e2e8f0, #94a3b8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-0.3px",
            marginBottom: 4,
          }}
        >
          📋 Kanban Board
        </h1>
        <p style={{ color: "#475569", fontSize: 14 }}>
          Drag and drop tasks across columns to update their status
        </p>
      </div>

      {/* AI Input */}
      <AICommandInput
        onCommandExecuted={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
        compact
      />

      {/* Kanban Board */}
      <KanbanBoard />
    </div>
  );
}
