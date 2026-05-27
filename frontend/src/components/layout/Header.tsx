import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Avatar, Dropdown, Badge, Tooltip } from "antd";
import { Menu, Bell, LogOut, User, Settings } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { getInitials } from "../../utils/helpers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { remindersApi } from "../../api/reminders.api";

const { Header: AntHeader } = Layout;

interface HeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: remindersData } = useQuery({
    queryKey: ["reminders", "pending"],
    queryFn: () => remindersApi.getAll(false),
  });

  const pendingReminders = remindersData?.data?.data?.length || 0;

  const menuItems = [
    {
      key: "profile",
      icon: <User size={14} />,
      label: "Profile",
      onClick: () => navigate("/profile"),
    },
    {
      key: "settings",
      icon: <Settings size={14} />,
      label: "Settings",
      onClick: () => navigate("/settings"),
    },
    { type: "divider" as const },
    {
      key: "logout",
      icon: <LogOut size={14} />,
      label: "Sign out",
      danger: true,
      onClick: () => {
        logout();
        queryClient.clear(); // Wipe all cached data — prevents previous user's data leaking to next login
        navigate("/login");
      },
    },
  ];

  return (
    <AntHeader
      style={{
        position: "sticky",
        top: 0,
        zIndex: 99,
        background: "rgba(15, 15, 19, 0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1e1e2a",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
      }}
    >
      {/* Left: Toggle + Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: "none",
            border: "1px solid #2a2a3a",
            borderRadius: 8,
            padding: "6px 8px",
            cursor: "pointer",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#1c1c28";
            (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "none";
            (e.currentTarget as HTMLElement).style.color = "#94a3b8";
          }}
        >
          <Menu size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 6px #10b981",
            }}
          />
          <span style={{ fontSize: 13, color: "#475569" }}>System Online</span>
        </div>
      </div>

      {/* Right: Actions + User */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Reminders Bell */}
        <Tooltip title={`${pendingReminders} pending reminders`}>
          <Badge count={pendingReminders} size="small" color="#6366f1">
            <button
              onClick={() => navigate("/reminders")}
              style={{
                background: "none",
                border: "1px solid #2a2a3a",
                borderRadius: 8,
                padding: "6px 8px",
                cursor: "pointer",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
                (e.currentTarget as HTMLElement).style.background = "#1c1c28";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#64748b";
                (e.currentTarget as HTMLElement).style.background = "none";
              }}
            >
              <Bell size={18} />
            </button>
          </Badge>
        </Tooltip>

        {/* User menu */}
        <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 8,
              border: "1px solid #2a2a3a",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#1c1c28";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <Avatar
              size={28}
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {user ? getInitials(user.name) : "U"}
            </Avatar>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                {user?.name || "User"}
              </span>
              <span style={{ fontSize: 11, color: "#475569" }}>{user?.email || ""}</span>
            </div>
          </div>
        </Dropdown>
      </div>
    </AntHeader>
  );
}
