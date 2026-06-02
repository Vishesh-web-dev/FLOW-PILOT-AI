import { Select, Button, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../../api/projects.api";
import { sprintsApi } from "../../api/sprints.api";
import { SlidersHorizontal, X } from "lucide-react";
import { useIsMobile } from "../../hooks/useIsMobile";

export interface KanbanFilters {
  projectIds: string[];
  sprintIds: string[];
}

interface KanbanFilterBarProps {
  filters: KanbanFilters;
  onChange: (filters: KanbanFilters) => void;
}

export default function KanbanFilterBar({ filters, onChange }: KanbanFilterBarProps) {
  const isMobile = useIsMobile();

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll(),
  });

  const { data: sprintsData } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => sprintsApi.getAll(),
  });

  const projects = projectsData?.data?.data || [];
  const sprints = sprintsData?.data?.data || [];

  const hasFilters = filters.projectIds.length > 0 || filters.sprintIds.length > 0;

  const clearAll = () => onChange({ projectIds: [], sprintIds: [] });

  const selectStyle = {
    background: "#1c1c28",
    border: "1px solid #2a2a3a",
    borderRadius: 8,
    color: "#e2e8f0",
    minWidth: isMobile ? "100%" : 180,
  };

  return (
    <div
      style={{
        background: "#16161d",
        border: "1px solid #1e1e2a",
        borderRadius: 12,
        padding: isMobile ? "10px 12px" : "12px 16px",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <SlidersHorizontal size={14} color="#6366f1" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Filters</span>
      </div>

      {/* Project multi-select */}
      <Select
        mode="multiple"
        allowClear
        placeholder="All Projects"
        value={filters.projectIds}
        onChange={(vals) => onChange({ ...filters, projectIds: vals })}
        style={selectStyle}
        dropdownStyle={{ background: "#1c1c28", border: "1px solid #2a2a3a" }}
        optionFilterProp="label"
        maxTagCount={isMobile ? 2 : "responsive"}
        options={[
          { value: "__none__", label: "No Project (unassigned)" },
          ...projects.map((p) => ({
            value: p.id,
            label: p.name,
          })),
        ]}
        tagRender={({ label, closable, onClose }) => (
          <Tag
            closable={closable}
            onClose={onClose}
            style={{
              background: "rgba(99,102,241,0.15)",
              border: "1px solid rgba(99,102,241,0.3)",
              color: "#a5b4fc",
              borderRadius: 6,
              fontSize: 11,
            }}
          >
            {label}
          </Tag>
        )}
      />

      {/* Sprint multi-select */}
      <Select
        mode="multiple"
        allowClear
        placeholder="All Sprints"
        value={filters.sprintIds}
        onChange={(vals) => onChange({ ...filters, sprintIds: vals })}
        style={selectStyle}
        dropdownStyle={{ background: "#1c1c28", border: "1px solid #2a2a3a" }}
        optionFilterProp="label"
        maxTagCount={isMobile ? 2 : "responsive"}
        options={[
          { value: "__none__", label: "No Sprint (unassigned)" },
          ...sprints.map((s) => ({
            value: s.id,
            label: s.name + (s.status === "ACTIVE" ? " 🟢" : s.status === "COMPLETED" ? " ✓" : ""),
          })),
        ]}
        tagRender={({ label, closable, onClose }) => (
          <Tag
            closable={closable}
            onClose={onClose}
            style={{
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.25)",
              color: "#6ee7b7",
              borderRadius: 6,
              fontSize: 11,
            }}
          >
            {label}
          </Tag>
        )}
      />

      {/* Active filter summary + clear */}
      {hasFilters && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: isMobile ? 0 : "auto" }}>
          <span style={{ fontSize: 12, color: "#475569" }}>
            {filters.projectIds.length + filters.sprintIds.length} filter{filters.projectIds.length + filters.sprintIds.length !== 1 ? "s" : ""} active
          </span>
          <Button
            size="small"
            type="text"
            icon={<X size={12} />}
            onClick={clearAll}
            style={{ color: "#ef4444", padding: "0 6px", height: 22 }}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
