import { useState } from "react";
import KanbanBoard from "../components/kanban/KanbanBoard";
import MobileKanban from "../components/kanban/MobileKanban";
import KanbanFilterBar, { KanbanFilters } from "../components/kanban/KanbanFilterBar";
import AICommandInput from "../components/ai/AICommandInput";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "../hooks/useIsMobile";

export default function KanbanPage() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [filters, setFilters] = useState<KanbanFilters>({
    projectIds: [],
    sprintIds: [],
  });

  // Build API-ready params from multi-select filter state
  const projectIdsParam = filters.projectIds.length > 0 ? filters.projectIds.join(",") : undefined;
  const sprintIdsParam = filters.sprintIds.length > 0
    ? filters.sprintIds.filter((s) => s !== "__none__").join(",")
    : undefined;
  const noSprintOnly = filters.sprintIds.includes("__none__") && filters.sprintIds.length === 1;

  return (
    <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          {isMobile ? "Tap a task to edit • Switch columns with tabs" : "Drag and drop tasks across columns to update their status"}
        </p>
      </div>

      {/* Filter Bar */}
      <KanbanFilterBar filters={filters} onChange={setFilters} />

      {/* AI Input */}
      <AICommandInput
        compact
      />

      {/* Board — DnD on desktop, tabbed list on mobile */}
      {isMobile
        ? <MobileKanban projectIds={projectIdsParam} sprintIds={sprintIdsParam} noSprintOnly={noSprintOnly} />
        : <KanbanBoard projectIds={projectIdsParam} sprintIds={sprintIdsParam} noSprintOnly={noSprintOnly} />
      }
    </div>
  );
}
