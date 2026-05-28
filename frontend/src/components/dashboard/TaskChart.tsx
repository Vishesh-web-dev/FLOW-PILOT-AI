import { useQuery } from "@tanstack/react-query";
import HighchartsReact from "highcharts-react-official";
import Highcharts from "highcharts";
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

// Apply global dark theme defaults once
Highcharts.setOptions({
  chart: {
    backgroundColor: "transparent",
    style: { fontFamily: "inherit" },
  },
  credits: { enabled: false },
  title: { text: undefined },
  legend: {
    itemStyle: { color: "#94a3b8", fontSize: "11px", fontWeight: "normal" },
    itemHoverStyle: { color: "#e2e8f0" },
  },
  tooltip: {
    backgroundColor: "#1c1c28",
    borderColor: "#2a2a3a",
    borderRadius: 8,
    style: { color: "#e2e8f0", fontSize: "12px" },
    shadow: false,
  },
});

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
        style={{ height: 220, borderRadius: 8 }}
      />
    );
  }

  if (!stats) return null;

  const chartData =
    type === "status"
      ? stats.byStatus.map((item) => ({
          name: STATUS_LABELS[item.status] || item.status,
          y: item._count,
          color: STATUS_COLORS[item.status] || "#6b7280",
        }))
      : stats.byPriority.map((item) => ({
          name: item.priority,
          y: item._count,
          color: PRIORITY_COLORS[item.priority] || "#6b7280",
        }));

  // ── Bar Chart ────────────────────────────────────────────────
  if (chartType === "bar") {
    const barOptions: Highcharts.Options = {
      chart: {
        type: "column",
        height: 220,
        animation: { duration: 600 },
        marginTop: 10,
      },
      xAxis: {
        categories: chartData.map((d) => d.name),
        labels: { style: { color: "#64748b", fontSize: "11px" } },
        lineColor: "#1e1e2a",
        tickColor: "#1e1e2a",
        crosshair: { color: "rgba(99,102,241,0.08)" },
      },
      yAxis: {
        allowDecimals: false,
        title: { text: undefined },
        gridLineDashStyle: "Dash",
        gridLineColor: "#1e1e2a",
        labels: { style: { color: "#64748b", fontSize: "11px" } },
      },
      plotOptions: {
        column: {
          borderRadius: 6,
          pointPadding: 0.15,
          groupPadding: 0.1,
          dataLabels: {
            enabled: true,
            style: {
              color: "#94a3b8",
              fontSize: "11px",
              fontWeight: "normal",
              textOutline: "none",
            },
            formatter() {
              return (this.y ?? 0) > 0 ? String(this.y) : "";
            },
          },
        },
      },
      series: [
        {
          type: "column",
          name: type === "status" ? "Tasks by Status" : "Tasks by Priority",
          data: chartData,
          showInLegend: false,
        },
      ],
      tooltip: {
        formatter() {
          return `<b>${this.x}</b><br/>Tasks: <b>${this.y}</b>`;
        },
      },
    };

    return <HighchartsReact highcharts={Highcharts} options={barOptions} />;
  }

  // ── Donut Chart ───────────────────────────────────────────────
  const pieOptions: Highcharts.Options = {
    chart: {
      type: "pie",
      height: 220,
      animation: { duration: 600 },
    },
    plotOptions: {
      pie: {
        innerSize: "55%",
        borderWidth: 2,
        borderColor: "#12121a",
        dataLabels: { enabled: false },
        showInLegend: true,
        states: { hover: { brightness: 0.1 } },
      },
    },
    legend: {
      align: "right",
      verticalAlign: "middle",
      layout: "vertical",
      itemStyle: { color: "#94a3b8", fontSize: "11px", fontWeight: "normal" },
      itemHoverStyle: { color: "#e2e8f0" },
      symbolRadius: 50,
      symbolWidth: 8,
      symbolHeight: 8,
    },
    series: [
      {
        type: "pie",
        name: type === "status" ? "Tasks by Status" : "Tasks by Priority",
        data: chartData,
      },
    ],
    tooltip: {
      formatter() {
        const pt = (this as unknown as { point: Highcharts.Point & { name: string } }).point;
        return `<b>${pt.name}</b><br/>Tasks: <b>${this.y}</b><br/>${this.percentage?.toFixed(1)}%`;
      },
    },
  };

  return <HighchartsReact highcharts={Highcharts} options={pieOptions} />;
}
