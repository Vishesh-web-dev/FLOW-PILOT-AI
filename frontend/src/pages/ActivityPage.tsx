import { useQuery } from "@tanstack/react-query";
import { Spin, Pagination } from "antd";
import { useState } from "react";
import { activitiesApi } from "../api/activities.api";
import { Activity } from "../types";
import {
  getActivityIcon,
  getActivityColor,
  formatDateTime,
  formatRelativeTime,
  getInitials,
} from "../utils/helpers";
import { Avatar } from "antd";

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["activities", { page, limit }],
    queryFn: () => activitiesApi.getAll({ page, limit }),
  });

  const activities: Activity[] = data?.data?.data || [];
  const total = data?.data?.meta?.total || 0;

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
          📋 Activity Timeline
        </h1>
        <p style={{ color: "#475569", fontSize: 14 }}>
          Complete history of all actions and changes in your workspace
        </p>
      </div>

      {/* Activity Feed */}
      <div
        style={{
          background: "#16161d",
          border: "1px solid #1e1e2a",
          borderRadius: 16,
          padding: 24,
        }}
      >
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : activities.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#475569" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p>No activity recorded yet. Start creating tasks!</p>
          </div>
        ) : (
          <div>
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
                    gap: 16,
                    paddingBottom: isLast ? 0 : 20,
                    position: "relative",
                  }}
                >
                  {/* Timeline line */}
                  {!isLast && (
                    <div
                      style={{
                        position: "absolute",
                        left: 15,
                        top: 36,
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
                      background: "#1c1c28",
                      border: "1px solid #2a2a3a",
                      borderRadius: 10,
                      padding: "10px 14px",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <Avatar
                            size={20}
                            style={{
                              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                              fontSize: 10,
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(activity.user?.name || "U")}
                          </Avatar>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                            {activity.user?.name}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: color,
                              background: `${color}15`,
                              padding: "1px 6px",
                              borderRadius: 4,
                              fontWeight: 500,
                            }}
                          >
                            {activity.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                          {activity.description}
                        </p>
                        {activity.task && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6366f1",
                              marginTop: 4,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span>→</span>
                            <span
                              style={{
                                background: "rgba(99,102,241,0.1)",
                                padding: "1px 6px",
                                borderRadius: 4,
                              }}
                            >
                              {activity.task.title}
                            </span>
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: "#475569",
                          flexShrink: 0,
                          textAlign: "right",
                        }}
                      >
                        <div>{formatRelativeTime(activity.createdAt)}</div>
                        <div style={{ marginTop: 2 }}>
                          {formatDateTime(activity.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {total > limit && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
                <Pagination
                  current={page}
                  total={total}
                  pageSize={limit}
                  onChange={setPage}
                  showSizeChanger={false}
                  style={{ color: "#94a3b8" }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
