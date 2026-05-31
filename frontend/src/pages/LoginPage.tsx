import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, Divider } from "antd";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Bot, Zap, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { authApi, LoginCredentials } from "../api/auth.api";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: (values: LoginCredentials) => authApi.login(values),
    onSuccess: (response) => {
      const { user, token } = response.data.data!;
      setAuth(user, token);
      toast.success(`Welcome back, ${user.name}! 👋`);
      navigate("/dashboard");
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || "Login failed. Please try again.";
      toast.error(message);
    },
  });

  const demoMutation = useMutation({
    mutationFn: () => authApi.demoLogin(),
    onSuccess: (response) => {
      const { user, token } = response.data.data!;
      setAuth(user, token);
      toast.success(`Welcome to the demo, ${user.name}! 🚀`);
      navigate("/dashboard");
    },
    onError: () => {
      toast.error("Failed to start demo session. Please try again.");
    },
  });

  return (
    <div
      className="auth-wrapper"
      style={{
        minHeight: "100vh",
        background: "#0f0f13",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Background effects */}
      <div
        style={{
          position: "fixed",
          top: "20%",
          left: "10%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "10%",
          right: "15%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 0 24px rgba(99,102,241,0.4)",
            }}
          >
            <Bot size={28} color="white" />
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              background: "linear-gradient(135deg, #a5b4fc, #c4b5fd)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: 8,
              letterSpacing: "-0.5px",
            }}
          >
            FlowPilot AI
          </h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Sign in to your workspace
          </p>
        </div>

        {/* Login Card */}
        <div
          className="auth-card"
          style={{
            background: "#16161d",
            border: "1px solid #1e1e2a",
            borderRadius: 20,
            padding: "32px 36px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          }}
        >
          {/* Demo button */}
          <button
            type="button"
            onClick={() => demoMutation.mutate()}
            disabled={demoMutation.isPending}
            style={{
              width: "100%",
              background: "rgba(99,102,241,0.08)",
              border: "1px dashed rgba(99,102,241,0.3)",
              borderRadius: 10,
              padding: "10px 16px",
              cursor: demoMutation.isPending ? "not-allowed" : "pointer",
              color: "#a5b4fc",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 24,
              transition: "all 0.15s ease",
              opacity: demoMutation.isPending ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!demoMutation.isPending)
                (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.08)";
            }}
          >
            <Zap size={14} />
            {demoMutation.isPending ? "Signing in..." : "Try Demo Account"}
          </button>

          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => mutation.mutate(values)}
            autoComplete="off"
          >
            <Form.Item
              name="email"
              label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Email</span>}
              rules={[
                { required: true, message: "Email is required" },
                { type: "email", message: "Enter a valid email" },
              ]}
            >
              <Input
                size="large"
                placeholder="you@example.com"
                style={{ borderRadius: 10 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Password</span>}
              rules={[{ required: true, message: "Password is required" }]}
            >
              <Input
                size="large"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                style={{ borderRadius: 10 }}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#475569",
                      display: "flex",
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={mutation.isPending}
              block
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: 10,
                height: 46,
                fontSize: 15,
                fontWeight: 600,
                boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
                marginTop: 8,
              }}
            >
              {mutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </Form>

          <Divider style={{ borderColor: "#1e1e2a", color: "#475569", fontSize: 12 }}>
            or
          </Divider>

          <div style={{ textAlign: "center" }}>
            <span style={{ color: "#64748b", fontSize: 14 }}>
              Don't have an account?{" "}
            </span>
            <Link
              to="/register"
              style={{
                color: "#a5b4fc",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Sign up free
            </Link>
          </div>
        </div>

        {/* Features list */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          {["AI-powered tasks", "Real-time sync", "Smart reminders"].map(
            (feature) => (
              <div
                key={feature}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "#475569",
                }}
              >
                <CheckCircle size={12} color="#10b981" />
                {feature}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
