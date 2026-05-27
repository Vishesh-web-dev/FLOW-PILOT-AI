import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ConfigProvider, theme } from "antd";
import App from "./App";
import "./index.css";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: "#6366f1",
            colorBgBase: "#0f0f13",
            colorBgContainer: "#16161d",
            colorBgElevated: "#1c1c28",
            colorBorder: "#1e1e2a",
            colorText: "#e2e8f0",
            colorTextSecondary: "#94a3b8",
            borderRadius: 8,
            fontFamily: "Inter, system-ui, sans-serif",
          },
          components: {
            Button: {
              colorPrimary: "#6366f1",
              algorithm: true,
            },
            Input: {
              colorBgContainer: "#1c1c28",
              colorBorder: "#2a2a3a",
            },
            Select: {
              colorBgContainer: "#1c1c28",
              colorBorder: "#2a2a3a",
            },
            Modal: {
              contentBg: "#16161d",
              headerBg: "#16161d",
              footerBg: "#16161d",
            },
            Card: {
              colorBgContainer: "#16161d",
            },
            Drawer: {
              colorBgElevated: "#16161d",
            },
            Table: {
              colorBgContainer: "#16161d",
              headerBg: "#1c1c28",
            },
          },
        }}
      >
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
