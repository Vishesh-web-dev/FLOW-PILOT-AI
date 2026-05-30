import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button } from "antd";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Bot, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { authApi, RegisterCredentials } from "../api/auth.api";
import { useAuthStore } from "../store/authStore";

export default function RegisterPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: (values: RegisterCredentials) => authApi.register(values),
    onSuccess: (response) => {
      const { user, token } = response.data.data!;
      setAuth(user, token);
      toast.success(`Welcome to FlowPilot AI, ${user.name}! 🚀`);
      navigate("/dashboard");
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || "Registration failed. Please try again.";
      toast.error(message);
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
          top: "15%",
          right: "10%",
          width: 350,
          height: 350,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
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
            Create Your Account
          </h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Start automating your workflow with AI
          </p>
        </div>

        {/* Register Card */}
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
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => mutation.mutate(values)}
          >
            <Form.Item
              name="name"
              label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Full Name</span>}
              rules={[
                { required: true, message: "Name is required" },
                { min: 2, message: "Name must be at least 2 characters" },
              ]}
            >
              <Input
                size="large"
                placeholder="John Doe"
                style={{ borderRadius: 10 }}
                autoFocus
              />
            </Form.Item>

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
              rules={[
                { required: true, message: "Password is required" },
                { min: 6, message: "Password must be at least 6 characters" },
              ]}
            >
              <Input
                size="large"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
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
              icon={<Sparkles size={16} />}
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: 10,
                height: 46,
                fontSize: 15,
                fontWeight: 600,
                boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {mutation.isPending ? "Creating account..." : "Create Account"}
            </Button>
          </Form>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <span style={{ color: "#64748b", fontSize: 14 }}>
              Already have an account?{" "}
            </span>
            <Link
              to="/login"
              style={{
                color: "#a5b4fc",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Sign in
            </Link>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#2a2a3a" }}>
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
