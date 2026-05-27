import { useQuery } from "@tanstack/react-query";
import { Spin } from "antd";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  TrendingUp,
  ListTodo,
  PlayCircle,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { tasksApi } from "../../api/tasks.api";
import { TaskStats } from "../../types";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  subtitle?: string;
  trend?: string;
}

function StatCard({ title, value, icon, color, bg, subtitle, trend }: StatCardProps) {
  return (
    <div
      className="animate-fade-in-up"
      style={{
        background: "#16161d",
        border: "1px solid #1e1e2a",
        borderRadius: 14,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        transition: "all 0.2s ease",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = color + "40";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px ${color}15`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#1e1e2a";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: bg,
          filter: "blur(30px)",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{title}</span>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
          }}
        >
          {icon}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{subtitle}</div>
        )}
        {trend && (
          <div
            style={{
              fontSize: 12,
              color: "#10b981",
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <TrendingUp size={10} />
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatsCards() {
  const { data, isLoading } = useQuery({
    queryKey: ["task-stats"],
    queryFn: tasksApi.getStats,
  });

  const stats: TaskStats | null = data?.data?.data || null;

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="animate-shimmer"
            style={{ height: 140, borderRadius: 14 }}
          />
        ))}
      </div>
    );
  }

  const todoCount = stats?.byStatus.find((s) => s.status === "TODO")?._count || 0;
  const inProgressCount = stats?.byStatus.find((s) => s.status === "IN_PROGRESS")?._count || 0;
  const inReviewCount = stats?.byStatus.find((s) => s.status === "IN_REVIEW")?._count || 0;
  const doneCount = stats?.byStatus.find((s) => s.status === "DONE")?._count || 0;

  const statCards = [
    {
      title: "Total Tasks",
      value: stats?.total || 0,
      icon: <CheckSquare size={18} />,
      color: "#6366f1",
      bg: "rgba(99,102,241,0.15)",
      subtitle: `${todoCount} todo · ${inProgressCount} in progress`,
    },
    {
      title: "Due Soon",
      value: stats?.dueSoon || 0,
      icon: <AlertTriangle size={18} />,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.15)",
      subtitle: "Tasks due in next 3 days",
    },
    {
      title: "Completed",
      value: doneCount,
      icon: <CheckCircle2 size={18} />,
      color: "#10b981",
      bg: "rgba(16,185,129,0.15)",
      subtitle: `${stats?.completedThisWeek || 0} this week`,
      trend: stats?.completedThisWeek ? `${stats.completedThisWeek} this week` : undefined,
    },
    {
      title: "In Review",
      value: inReviewCount,
      icon: <Eye size={18} />,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.15)",
      subtitle: "Awaiting review",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
      {statCards.map((card, i) => (
        <StatCard key={i} {...card} />
      ))}
    </div>
  );
}
