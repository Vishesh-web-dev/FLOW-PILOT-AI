import { useQuery } from "@tanstack/react-query";
import { Spin } from "antd";
import { activitiesApi } from "../../api/activities.api";
import {
  getActivityIcon,
  getActivityColor,
  formatRelativeTime,
  getInitials,
} from "../../utils/helpers";
import { Activity } from "../../types";

interface ActivityTimelineProps {
  limit?: number;
  showUser?: boolean;
}

export default function ActivityTimeline({
  limit = 15,
  showUser = true,
}: ActivityTimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["activities", { limit }],
    queryFn: () => activitiesApi.getAll({ limit }),
  });

  const activities: Activity[] = data?.data?.data || [];

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="animate-shimmer"
            style={{ height: 56, borderRadius: 8 }}
          />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
          color: "#475569",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
        <p>No activity yet. Start creating tasks!</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {activities.map((activity, index) => {
        const isLast = index === activities.length - 1;
        const color = getActivityColor(activity.type);
        const icon = getActivityIcon(activity.type);

        return (
          <div
            key={activity.id}
            className="animate-fade-in-up"
            style={{
              display: "flex",
              gap: 12,
              paddingBottom: isLast ? 0 : 16,
              position: "relative",
            }}
          >
            {/* Timeline line */}
            {!isLast && (
              <div
                style={{
                  position: "absolute",
                  left: 15,
                  top: 32,
                  bottom: 0,
                  width: 1,
                  background: "linear-gradient(to bottom, #2a2a3a, transparent)",
                }}
              />
            )}

            {/* Icon */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: `${color}15`,
                border: `1px solid ${color}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                flexShrink: 0,
                zIndex: 1,
              }}
            >
              {icon}
            </div>

            {/* Content */}
            <div
              style={{
                flex: 1,
                padding: "6px 0",
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                {showUser && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                    {activity.user?.name || "User"}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 13,
                    color: "#94a3b8",
                    lineHeight: 1.5,
                  }}
                >
                  {activity.description}
                </span>
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#475569",
                  marginTop: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>{formatRelativeTime(activity.createdAt)}</span>
                {activity.project && (
                  <>
                    <span style={{ color: "#2a2a3a" }}>·</span>
                    <span
                      style={{
                        color: "#22c55e",
                        fontSize: 11,
                        background: "rgba(34,197,94,0.1)",
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      📁 {activity.project.name}
                    </span>
                  </>
                )}
                {activity.task && (
                  <>
                    <span style={{ color: "#2a2a3a" }}>·</span>
                    <span
                      style={{
                        color: "#6366f1",
                        fontSize: 11,
                        background: "rgba(99,102,241,0.1)",
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {activity.task.title}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
