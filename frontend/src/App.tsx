import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import KanbanPage from "./pages/KanbanPage";
import SprintsPage from "./pages/SprintsPage";
import ActivityPage from "./pages/ActivityPage";
import RemindersPage from "./pages/RemindersPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProfilePage from "./pages/ProfilePage";
import SchedulerPage from "./pages/SchedulerPage";

const SCHEDULER_EMAIL = "visheshshrivastava2002@gmail.com";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const SchedulerRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.email !== SCHEDULER_EMAIL) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#16161d",
            color: "#e2e8f0",
            border: "1px solid #2a2a3a",
            borderRadius: "10px",
            fontSize: "14px",
          },
          success: {
            iconTheme: { primary: "#10b981", secondary: "#fff" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#fff" },
          },
        }}
      />
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="sprints" element={<SprintsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<ProfilePage />} />
          <Route
            path="scheduler"
            element={
              <SchedulerRoute>
                <SchedulerPage />
              </SchedulerRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
