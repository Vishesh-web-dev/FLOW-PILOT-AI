import { useNavigate, useLocation } from "react-router-dom";
import { Layout, Tooltip } from "antd";
import {
  LayoutDashboard,
  Kanban,
  Zap,
  Activity,
  Bell,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  Bot,
} from "lucide-react";

const { Sider } = Layout;

interface NavItem {
  key: string;
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { key: "dashboard", path: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "kanban", path: "/kanban", label: "Kanban Board", icon: <Kanban size={18} /> },
  { key: "sprints", path: "/sprints", label: "Sprints", icon: <Zap size={18} /> },
  { key: "projects", path: "/projects", label: "Projects", icon: <FolderKanban size={18} /> },
  { key: "activity", path: "/activity", label: "Activity", icon: <Activity size={18} /> },
  { key: "reminders", path: "/reminders", label: "Reminders", icon: <Bell size={18} /> },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

export default function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = navItems.find((item) => location.pathname.startsWith(item.path))?.key;

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={240}
      collapsedWidth={72}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100vh",
        background: "#0d0d11",
        borderRight: "1px solid #1e1e2a",
        zIndex: 100,
        transition: "width 0.3s ease",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "0" : "0 20px",
          borderBottom: "1px solid #1e1e2a",
          gap: 10,
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 0 16px rgba(99, 102, 241, 0.4)",
          }}
        >
          <Bot size={18} color="white" />
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                background: "linear-gradient(135deg, #a5b4fc, #c4b5fd)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "-0.3px",
              }}
            >
              FlowPilot AI
            </div>
            <div style={{ fontSize: 10, color: "#4b5563", marginTop: -2 }}>
              Workflow Automation
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ padding: "12px 8px", flex: 1 }}>
        {navItems.map((item) => {
          const isActive = activeKey === item.key;
          const navEl = (
            <div
              key={item.key}
              onClick={() => navigate(item.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: collapsed ? "10px 0" : "10px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 8,
                cursor: "pointer",
                color: isActive ? "#a5b4fc" : "#64748b",
                background: isActive ? "rgba(99, 102, 241, 0.12)" : "transparent",
                borderLeft: isActive && !collapsed ? "2px solid #6366f1" : "2px solid transparent",
                marginBottom: 4,
                transition: "all 0.15s ease",
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#64748b";
                }
              }}
            >
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </div>
          );

          return collapsed ? (
            <Tooltip key={item.key} title={item.label} placement="right">
              {navEl}
            </Tooltip>
          ) : (
            navEl
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div
        onClick={() => onCollapse(!collapsed)}
        style={{
          position: "absolute",
          bottom: 20,
          right: collapsed ? "50%" : 12,
          transform: collapsed ? "translateX(50%)" : "none",
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#1c1c28",
          border: "1px solid #2a2a3a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#64748b",
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
          (e.currentTarget as HTMLElement).style.background = "#2a2a3a";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "#64748b";
          (e.currentTarget as HTMLElement).style.background = "#1c1c28";
        }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </div>
    </Sider>
  );
}
