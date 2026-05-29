import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal, Form, Input, Select, Button, Tag, Popconfirm,
  Tooltip, Avatar, Badge, Empty, Spin, Tabs,
} from "antd";
import {
  Users, UserPlus, Crown, Shield, Eye, User,
  Mail, Trash2, LogOut, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { teamApi } from "../../api/team.api";
import { projectsApi } from "../../api/projects.api";
import { useAuthStore } from "../../store/authStore";
import { Project, ProjectMember, ProjectInvite, ProjectRole } from "../../types";
import toast from "react-hot-toast";

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<ProjectRole, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  OWNER:  { label: "Owner",  color: "#6366f1", icon: <Crown  size={12} />, description: "Full control, can delete project" },
  ADMIN:  { label: "Admin",  color: "#f59e0b", icon: <Shield size={12} />, description: "Can manage members and settings" },
  MEMBER: { label: "Member", color: "#10b981", icon: <User   size={12} />, description: "Can create and edit tasks" },
  VIEWER: { label: "Viewer", color: "#6b7280", icon: <Eye    size={12} />, description: "Read-only access" },
};

function RoleBadge({ role }: { role: ProjectRole }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <Tag
      style={{
        background: cfg.color + "20",
        border: `1px solid ${cfg.color}40`,
        color: cfg.color,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 6,
        fontSize: 11,
        padding: "1px 8px",
      }}
    >
      {cfg.icon} {cfg.label}
    </Tag>
  );
}

// ─── Invite Notification Banner ───────────────────────────────────────────────
export function PendingInvitesBanner() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-invites"],
    queryFn: teamApi.getMyInvites,
    refetchInterval: 30000,
  });
  const invites: ProjectInvite[] = data?.data?.data || [];

  const acceptMutation = useMutation({
    mutationFn: teamApi.acceptInvite,
    onSuccess: (_, token) => {
      queryClient.invalidateQueries({ queryKey: ["my-invites"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Joined project!");
    },
    onError: () => toast.error("Failed to accept invite"),
  });

  const declineMutation = useMutation({
    mutationFn: teamApi.declineInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-invites"] });
      toast.success("Invite declined");
    },
    onError: () => toast.error("Failed to decline"),
  });

  if (!invites.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
      {invites.map((invite) => (
        <div
          key={invite.id}
          style={{
            background: "linear-gradient(135deg, #1a1a2e, #16161d)",
            border: "1px solid #6366f140",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: invite.project?.color + "30", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={16} color={invite.project?.color || "#6366f1"} />
            </div>
            <div>
              <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>
                {invite.invitedBy?.name} invited you to <span style={{ color: "#6366f1" }}>{invite.project?.name}</span>
              </p>
              <p style={{ margin: 0, color: "#64748b", fontSize: 11, marginTop: 2 }}>
                as <RoleBadge role={invite.role} /> · expires {new Date(invite.expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              size="small"
              type="primary"
              loading={acceptMutation.isPending}
              onClick={() => acceptMutation.mutate(invite.token)}
              style={{ background: "#6366f1", borderColor: "#6366f1", fontSize: 12 }}
            >
              Accept
            </Button>
            <Button
              size="small"
              loading={declineMutation.isPending}
              onClick={() => declineMutation.mutate(invite.token)}
              style={{ background: "transparent", borderColor: "#374151", color: "#9ca3af", fontSize: 12 }}
            >
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Team Management Modal ────────────────────────────────────────────────────
interface TeamModalProps {
  project: Project;
  open: boolean;
  onClose: () => void;
}

export function TeamManagementModal({ project, open, onClose }: TeamModalProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [inviteForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState("members");

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["team-members", project.id],
    queryFn: () => teamApi.getMembers(project.id),
    enabled: open,
  });

  const { data: invitesData, isLoading: invitesLoading } = useQuery({
    queryKey: ["team-invites", project.id],
    queryFn: () => teamApi.getProjectInvites(project.id),
    enabled: open && (project.myRole === "OWNER" || project.myRole === "ADMIN"),
  });

  const members: ProjectMember[] = membersData?.data?.data || [];
  const invites: ProjectInvite[] = (invitesData?.data as any)?.data || [];

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: ProjectRole }) =>
      teamApi.inviteMember(project.id, { email, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invites", project.id] });
      toast.success("Invitation sent!");
      inviteForm.resetFields();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to send invite"),
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: ProjectRole }) =>
      teamApi.updateRole(project.id, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", project.id] });
      toast.success("Role updated");
    },
    onError: () => toast.error("Failed to update role"),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => teamApi.removeMember(project.id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", project.id] });
      toast.success("Member removed");
    },
    onError: () => toast.error("Failed to remove member"),
  });

  const leaveMutation = useMutation({
    mutationFn: () => teamApi.leaveProject(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Left project");
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || "Failed to leave"),
  });

  const canManage = project.myRole === "OWNER" || project.myRole === "ADMIN";
  const isOwner = project.myRole === "OWNER";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={580}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: project.color + "30", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={16} color={project.color} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: "#e2e8f0", fontSize: 15 }}>{project.name}</p>
            <p style={{ margin: 0, color: "#64748b", fontSize: 11 }}>{members.length} member{members.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      }
      styles={{ content: { background: "#12121a", border: "1px solid #1e1e2a", borderRadius: 16 }, header: { background: "#12121a", borderBottom: "1px solid #1e1e2a" } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 4 }}
        items={[
          {
            key: "members",
            label: <span style={{ color: "#94a3b8" }}>Members ({members.length})</span>,
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {membersLoading ? (
                  <div style={{ textAlign: "center", padding: 24 }}><Spin /></div>
                ) : (
                  members.map((member) => {
                    const isMe = member.userId === user?.id;
                    const isThisOwner = member.role === "OWNER";
                    return (
                      <div
                        key={member.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          background: "#16161d",
                          border: "1px solid #1e1e2a",
                          borderRadius: 10,
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar
                            style={{ background: "#6366f1", fontSize: 12 }}
                            size={36}
                            src={member.user.avatar}
                          >
                            {member.user.name[0].toUpperCase()}
                          </Avatar>
                          <div>
                            <p style={{ margin: 0, color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>
                              {member.user.name} {isMe && <span style={{ color: "#64748b", fontSize: 11 }}>(you)</span>}
                            </p>
                            <p style={{ margin: 0, color: "#64748b", fontSize: 11 }}>{member.user.email}</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isOwner && !isMe && !isThisOwner ? (
                            <Select
                              value={member.role}
                              size="small"
                              style={{ width: 100 }}
                              onChange={(role) => roleChangeMutation.mutate({ memberId: member.id, role: role as ProjectRole })}
                              options={[
                                { value: "ADMIN", label: "Admin" },
                                { value: "MEMBER", label: "Member" },
                                { value: "VIEWER", label: "Viewer" },
                              ]}
                            />
                          ) : (
                            <RoleBadge role={member.role} />
                          )}
                          {canManage && !isMe && !isThisOwner && (
                            <Popconfirm
                              title="Remove this member?"
                              onConfirm={() => removeMutation.mutate(member.id)}
                              okText="Remove"
                              okButtonProps={{ danger: true }}
                            >
                              <Button size="small" type="text" danger icon={<Trash2 size={13} />} />
                            </Popconfirm>
                          )}
                          {isMe && !isThisOwner && (
                            <Popconfirm title="Leave this project?" onConfirm={() => leaveMutation.mutate()} okText="Leave" okButtonProps={{ danger: true }}>
                              <Button size="small" type="text" danger icon={<LogOut size={13} />} />
                            </Popconfirm>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ),
          },
          ...(canManage ? [{
            key: "invite",
            label: <span style={{ color: "#94a3b8" }}>Invite</span>,
            children: (
              <div>
                <Form
                  form={inviteForm}
                  onFinish={(values) => inviteMutation.mutate(values)}
                  layout="vertical"
                  style={{ marginBottom: 20 }}
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    <Form.Item name="email" rules={[{ required: true, type: "email", message: "Valid email required" }]} style={{ flex: 1, marginBottom: 0 }}>
                      <Input
                        prefix={<Mail size={13} color="#64748b" />}
                        placeholder="colleague@company.com"
                        style={{ background: "#16161d", borderColor: "#1e1e2a", color: "#e2e8f0" }}
                      />
                    </Form.Item>
                    <Form.Item name="role" initialValue="MEMBER" style={{ width: 110, marginBottom: 0 }}>
                      <Select
                        style={{ width: 110 }}
                        options={[
                          { value: "ADMIN",  label: "Admin" },
                          { value: "MEMBER", label: "Member" },
                          { value: "VIEWER", label: "Viewer" },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button
                        htmlType="submit"
                        type="primary"
                        loading={inviteMutation.isPending}
                        icon={<UserPlus size={13} />}
                        style={{ background: "#6366f1", borderColor: "#6366f1" }}
                      >
                        Invite
                      </Button>
                    </Form.Item>
                  </div>
                </Form>

                {/* Pending invites list */}
                <p style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>Pending Invitations</p>
                {invitesLoading ? <Spin size="small" /> : invites.filter(i => i.status === "PENDING").length === 0 ? (
                  <p style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: "16px 0" }}>No pending invitations</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {invites.filter(i => i.status === "PENDING").map((inv) => (
                      <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#16161d", border: "1px solid #1e1e2a", borderRadius: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Mail size={13} color="#64748b" />
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>{inv.email}</span>
                          <RoleBadge role={inv.role} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Clock size={11} color="#64748b" />
                          <span style={{ color: "#64748b", fontSize: 11 }}>Pending</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          }] : []),
        ]}
      />
    </Modal>
  );
}
