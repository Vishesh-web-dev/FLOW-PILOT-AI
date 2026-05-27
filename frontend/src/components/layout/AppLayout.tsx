import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Layout } from "antd";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useSocket } from "../../hooks/useSocket";

const { Content } = Layout;

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useSocket(); // Initialize socket connection

  return (
    <Layout style={{ minHeight: "100vh", background: "#0f0f13" }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
      />
      <Layout
        style={{
          marginLeft: sidebarCollapsed ? 72 : 240,
          transition: "margin-left 0.3s ease",
          background: "#0f0f13",
        }}
      >
        <Header
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <Content
          style={{
            padding: "24px",
            minHeight: "calc(100vh - 64px)",
            background: "#0f0f13",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
