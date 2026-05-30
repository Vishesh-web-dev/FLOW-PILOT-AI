import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Kanban, Zap, Activity, Bell, FolderKanban } from "lucide-react";

const navItems = [
  { key: "dashboard", path: "/dashboard", label: "Home", icon: <LayoutDashboard size={20} /> },
  { key: "kanban", path: "/kanban", label: "Board", icon: <Kanban size={20} /> },
  { key: "sprints", path: "/sprints", label: "Sprints", icon: <Zap size={20} /> },
  { key: "projects", path: "/projects", label: "Projects", icon: <FolderKanban size={20} /> },
  { key: "activity", path: "/activity", label: "Activity", icon: <Activity size={20} /> },
  { key: "reminders", path: "/reminders", label: "Reminders", icon: <Bell size={20} /> },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeKey = navItems.find((item) => location.pathname.startsWith(item.path))?.key;

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        background: "rgba(13, 13, 17, 0.98)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid #1e1e2a",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 200,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {navItems.map((item) => {
        const isActive = activeKey === item.key;
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
            style={{
              background: "none",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "6px 10px",
              borderRadius: 10,
              cursor: "pointer",
              color: isActive ? "#a5b4fc" : "#475569",
              transition: "all 0.15s ease",
              minWidth: 44,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
                transition: "background 0.15s ease",
              }}
            >
              {item.icon}
            </div>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
