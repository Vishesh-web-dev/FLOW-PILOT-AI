import { useQuery } from "@tanstack/react-query";
import { Button, Spin } from "antd";
import { useAuthStore } from "../store/authStore";
import { tasksApi } from "../api/tasks.api";
import StatsCards from "../components/dashboard/StatsCards";
import ActivityTimeline from "../components/dashboard/ActivityTimeline";
import TaskChart from "../components/dashboard/TaskChart";
import AICommandInput from "../components/ai/AICommandInput";
import { Task } from "../types";
import {
  getPriorityConfig,
  getStatusConfig,
  formatRelativeTime,
  isOverdue,
} from "../utils/helpers";
import { CalendarDays, ArrowRight, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", { status: "TODO" }],
    queryFn: () => tasksApi.getAll({ status: "TODO" }),
  });

  const tasks: Task[] = tasksData?.data?.data || [];

  return (
    <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Greeting Header */}
      <div
        className="dashboard-greeting"
        style={{
          background: "linear-gradient(135deg, #16161d 0%, #1a1a2e 100%)",
          border: "1px solid #1e1e2a",
          borderRadius: 16,
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 200,
            height: 200,
            background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div>
          <p style={{ fontSize: 13, color: "#475569", margin: 0, marginBottom: 4 }}>
            {dateStr}
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              background: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.5px",
              margin: 0,
            }}
          >
            {greeting}, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "6px 0 0" }}>
            Here's your workspace overview
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button
            onClick={() => navigate("/kanban")}
            style={{
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.2)",
              color: "#6366f1",
              borderRadius: 10,
              fontWeight: 600,
              height: 38,
            }}
            icon={<ArrowRight size={14} />}
          >
            Open Kanban
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Main Content Grid */}
      <div className="dashboard-split" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0, overflow: "hidden" }}>
          {/* AI Command */}
          <AICommandInput compact />

          {/* Upcoming Tasks */}
          <div
            className="upcoming-tasks-card"
            style={{
              background: "#16161d",
              border: "1px solid #1e1e2a",
              borderRadius: 16,
              padding: 20,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarDays size={16} color="#6366f1" />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>
                  Upcoming Tasks
                </span>
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => navigate("/kanban")}
                icon={<ArrowRight size={12} />}
                style={{ color: "#6366f1", fontSize: 12, padding: 0 }}
              >
                View all
              </Button>
            </div>

            {tasksLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <Spin />
              </div>
            ) : tasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#475569", fontSize: 13 }}>
                🎉 No tasks yet! Ask AI to create some.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tasks.slice(0, 6).map((task) => {
                  const priorityConf = getPriorityConfig(task.priority);
                  const statusConf = getStatusConfig(task.status);
                  const overdue = task.dueDate ? isOverdue(task.dueDate) && task.status !== "DONE" : false;

                  return (
                    <div
                      key={task.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        background: "#1c1c28",
                        border: `1px solid ${overdue ? "rgba(239,68,68,0.2)" : "#2a2a3a"}`,
                        borderLeft: `3px solid ${priorityConf.color}`,
                        borderRadius: 9,
                        transition: "all 0.15s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = "#22222f";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = "#1c1c28";
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: task.status === "DONE" ? "#475569" : "#e2e8f0",
                            textDecoration: task.status === "DONE" ? "line-through" : "none",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {task.title}
                        </div>
                        {task.dueDate && (
                          <div
                            style={{
                              fontSize: 11,
                              color: overdue ? "#ef4444" : "#475569",
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              marginTop: 2,
                            }}
                          >
                            <Clock size={10} />
                            {overdue ? "Overdue · " : ""}
                            {formatRelativeTime(task.dueDate)}
                          </div>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 5,
                          background: `${statusConf.color}15`,
                          color: statusConf.color,
                          border: `1px solid ${statusConf.color}25`,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {statusConf.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Activity */}
        <ActivityTimeline limit={8} />
      </div>

      {/* Charts Row */}
      <div className="charts-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <TaskChart type="status" />
        <TaskChart type="priority" />
      </div>
    </div>
  );
}
