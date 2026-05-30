import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Layout } from "antd";
import Sidebar from "./Sidebar";
import Header from "./Header";
import BottomNav from "./BottomNav";
import { useSocket } from "../../hooks/useSocket";
import { useIsMobile } from "../../hooks/useIsMobile";

const { Content } = Layout;

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();
  useSocket();

  return (
    <Layout style={{ minHeight: "100vh", background: "#0f0f13" }}>
      {/* Sidebar — desktop only */}
      {!isMobile && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
        />
      )}

      <Layout
        style={{
          marginLeft: isMobile ? 0 : sidebarCollapsed ? 72 : 240,
          transition: "margin-left 0.3s ease",
          background: "#0f0f13",
        }}
      >
        <Header
          sidebarCollapsed={isMobile ? true : sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <Content
          style={{
            padding: isMobile ? "16px 12px" : "24px",
            paddingBottom: isMobile ? 80 : 24, // leave room for bottom nav
            minHeight: "calc(100vh - 64px)",
            background: "#0f0f13",
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      {/* Bottom Nav — mobile only */}
      {isMobile && <BottomNav />}
    </Layout>
  );
}
