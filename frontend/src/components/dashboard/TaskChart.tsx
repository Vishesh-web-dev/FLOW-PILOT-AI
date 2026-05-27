import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { tasksApi } from "../../api/tasks.api";
import { TaskStats } from "../../types";

const STATUS_COLORS: Record<string, string> = {
  TODO: "#6b7280",
  IN_PROGRESS: "#6366f1",
  IN_REVIEW: "#f59e0b",
  DONE: "#10b981",
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#6b7280",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  URGENT: "#dc2626",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

const CustomBarTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "#1c1c28",
          border: "1px solid #2a2a3a",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 12,
          color: "#e2e8f0",
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
        <p style={{ color: payload[0].color }}>Count: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

interface TaskChartProps {
  type?: "status" | "priority";
  chartType?: "bar" | "pie";
}

export default function TaskChart({
  type = "status",
  chartType = "bar",
}: TaskChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["task-stats"],
    queryFn: tasksApi.getStats,
  });

  const stats: TaskStats | null = data?.data?.data || null;

  if (isLoading) {
    return (
      <div
        className="animate-shimmer"
        style={{ height: 200, borderRadius: 8 }}
      />
    );
  }

  if (!stats) return null;

  const chartData =
    type === "status"
      ? stats.byStatus.map((item) => ({
          name: STATUS_LABELS[item.status] || item.status,
          value: item._count,
          color: STATUS_COLORS[item.status] || "#6b7280",
        }))
      : stats.byPriority.map((item) => ({
          name: item.priority,
          value: item._count,
          color: PRIORITY_COLORS[item.priority] || "#6b7280",
        }));

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={70}
            innerRadius={40}
            dataKey="value"
            paddingAngle={3}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#1c1c28",
              border: "1px solid #2a2a3a",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} barSize={32}>
        <XAxis
          dataKey="name"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={25}
        />
        <Tooltip content={<CustomBarTooltip />} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
