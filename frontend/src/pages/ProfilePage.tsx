import { useRef, useState } from "react";
import { Form, Input, Button, Tabs, Avatar, Spin } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Lock, CheckCircle, FolderKanban, Zap, Camera, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/authStore";
import { getInitials } from "../utils/helpers";

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#0ea5e9",
];

const isImageUrl = (s?: string | null) =>
  !!s && (s.startsWith("http://") || s.startsWith("https://"));

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [selectedColor, setSelectedColor] = useState<string>(
    isImageUrl(user?.avatar) ? "#6366f1" : (user?.avatar || "#6366f1")
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    isImageUrl(user?.avatar) ? user!.avatar! : null
  );

  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.getMe(),
  });
  const me = meData?.data?.data as any;

  // ── Upload avatar mutation ──────────────────────────────────────────────────
  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: (res) => {
      const updated = res.data.data!;
      updateUser({ avatar: updated.avatar ?? undefined });
      setPreviewUrl(updated.avatar ?? null);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile photo updated!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to upload photo");
    },
  });

  // ── Remove avatar mutation ──────────────────────────────────────────────────
  const deleteAvatarMutation = useMutation({
    mutationFn: () => authApi.deleteAvatar(),
    onSuccess: () => {
      updateUser({ avatar: undefined });
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile photo removed");
    },
    onError: () => toast.error("Failed to remove photo"),
  });

  // ── Update profile mutation ─────────────────────────────────────────────────
  const updateProfileMutation = useMutation({
    mutationFn: (values: { name: string }) =>
      authApi.updateProfile({
        name: values.name,
        // Only send color as avatar if user has no image
        ...(!previewUrl && { avatar: selectedColor }),
      }),
    onSuccess: (res) => {
      const updated = res.data.data!;
      updateUser({ name: updated.name, avatar: updated.avatar ?? undefined });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile updated!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update profile");
    },
  });

  // ── Change password mutation ────────────────────────────────────────────────
  const changePasswordMutation = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(values),
    onSuccess: () => {
      toast.success("Password changed successfully!");
      passwordForm.resetFields();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to change password");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }
    // Local preview instantly
    setPreviewUrl(URL.createObjectURL(file));
    uploadAvatarMutation.mutate(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const stats = [
    { label: "Tasks", value: me?._count?.tasks ?? 0, icon: <CheckCircle size={16} color="#6366f1" />, color: "#6366f1" },
    { label: "Projects", value: me?._count?.projects ?? 0, icon: <FolderKanban size={16} color="#8b5cf6" />, color: "#8b5cf6" },
    { label: "Sprints", value: me?._count?.sprints ?? 0, icon: <Zap size={16} color="#22c55e" />, color: "#22c55e" },
  ];

  const tabItems = [
    {
      key: "profile",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <User size={14} /> Profile
        </span>
      ),
      children: (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── Avatar section ─────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>
              Profile Photo
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              {/* Avatar preview */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                {previewUrl ? (
                  <Avatar
                    size={80}
                    src={previewUrl}
                    style={{ border: "3px solid #2a2a3a" }}
                  />
                ) : (
                  <Avatar
                    size={80}
                    style={{
                      background: selectedColor,
                      fontSize: 28,
                      fontWeight: 700,
                      border: "3px solid #2a2a3a",
                      boxShadow: `0 0 20px ${selectedColor}44`,
                    }}
                  >
                    {getInitials(user?.name || "U")}
                  </Avatar>
                )}
                {/* Camera overlay button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAvatarMutation.isPending}
                  title="Upload photo"
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#6366f1",
                    border: "2px solid #0f0f13",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {uploadAvatarMutation.isPending
                    ? <Spin size="small" />
                    : <Camera size={12} color="white" />}
                </button>
              </div>

              {/* Upload / Remove buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Button
                  size="small"
                  icon={<Camera size={13} />}
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploadAvatarMutation.isPending}
                  style={{ borderColor: "#2a2a3a", color: "#94a3b8", borderRadius: 8 }}
                >
                  {previewUrl ? "Change Photo" : "Upload Photo"}
                </Button>
                {previewUrl && (
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={13} />}
                    onClick={() => deleteAvatarMutation.mutate()}
                    loading={deleteAvatarMutation.isPending}
                    style={{ borderRadius: 8 }}
                  >
                    Remove Photo
                  </Button>
                )}
                <span style={{ fontSize: 11, color: "#475569" }}>
                  JPG, PNG, WebP · max 5 MB
                </span>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>

            {/* Color picker — only visible when no photo */}
            {!previewUrl && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#475569" }}>
                  Or pick an avatar color:
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: color,
                        border: selectedColor === color ? "2px solid #fff" : "2px solid transparent",
                        cursor: "pointer",
                        outline: selectedColor === color ? `2px solid ${color}` : "none",
                        outlineOffset: 2,
                        transition: "all 0.15s",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Name / Email form ──────────────────────────────────────────── */}
          <Form
            form={profileForm}
            layout="vertical"
            initialValues={{ name: user?.name }}
            onFinish={(values) => updateProfileMutation.mutate(values)}
            style={{ maxWidth: 440 }}
          >
            <Form.Item
              name="name"
              label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Display Name</span>}
              rules={[
                { required: true, message: "Name is required" },
                { min: 2, message: "At least 2 characters" },
              ]}
            >
              <Input size="large" style={{ borderRadius: 10 }} placeholder="Your name" />
            </Form.Item>

            <Form.Item label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Email</span>}>
              <Input
                size="large"
                value={user?.email}
                disabled
                style={{ borderRadius: 10, opacity: 0.5 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateProfileMutation.isPending}
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 600,
                  height: 40,
                }}
              >
                Save Changes
              </Button>
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      key: "security",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Lock size={14} /> Security
        </span>
      ),
      children: (
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={(values) => changePasswordMutation.mutate(values)}
          style={{ maxWidth: 440 }}
        >
          <Form.Item
            name="currentPassword"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Current Password</span>}
            rules={[{ required: true, message: "Required" }]}
          >
            <Input.Password size="large" style={{ borderRadius: 10 }} placeholder="Enter current password" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>New Password</span>}
            rules={[
              { required: true, message: "Required" },
              { min: 6, message: "At least 6 characters" },
            ]}
          >
            <Input.Password size="large" style={{ borderRadius: 10 }} placeholder="New password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Confirm New Password</span>}
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Required" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password size="large" style={{ borderRadius: 10 }} placeholder="Confirm new password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={changePasswordMutation.isPending}
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: 10,
                fontWeight: 600,
                height: 40,
              }}
            >
              Change Password
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

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
          My Profile
        </h1>
        <p style={{ color: "#475569", fontSize: 14 }}>
          Manage your account details and security settings
        </p>
      </div>

      {/* Stats */}
      {meLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
          <Spin />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                flex: "1 1 120px",
                background: "#16161d",
                border: "1px solid #1e1e2a",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `${s.color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs card */}
      <div
        style={{
          background: "#16161d",
          border: "1px solid #1e1e2a",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <Tabs items={tabItems} defaultActiveKey="profile" />
      </div>
    </div>
  );
}
