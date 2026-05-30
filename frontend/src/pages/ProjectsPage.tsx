import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Spin,
  Tag,
  Popconfirm,
  Empty,
  Avatar,
  Tooltip,
} from "antd";
import { useState } from "react";
import { projectsApi } from "../api/projects.api";
import { Project } from "../types";
import { Plus, Folder, Trash2, Edit3, Layers, Kanban, Users, Crown } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { PROJECT_COLORS } from "../utils/helpers";
import { TeamManagementModal, PendingInvitesBanner } from "../components/team/TeamManagementModal";

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [teamModalProject, setTeamModalProject] = useState<Project | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll(),
  });

  const projects: Project[] = data?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created!");
      closeModal();
    },
    onError: () => toast.error("Failed to create project"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof projectsApi.update>[1] }) =>
      projectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project updated!");
      closeModal();
    },
    onError: () => toast.error("Failed to update project"),
  });

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
    },
    onError: () => toast.error("Failed to delete project"),
  });

  const openCreate = () => {
    setEditingProject(null);
    form.resetFields();
    form.setFieldValue("color", PROJECT_COLORS[0]);
    setModalOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description,
      color: project.color,
      status: project.status,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProject(null);
    form.resetFields();
  };

  const handleSubmit = (values: { name: string; description?: string; color?: string; status?: string }) => {
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "ACTIVE": return "#22c55e";
      case "ON_HOLD": return "#f59e0b";
      case "COMPLETED": return "#6366f1";
      case "ARCHIVED": return "#475569";
      default: return "#22c55e";
    }
  };

  return (
    <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Pending invites banner */}
      <PendingInvitesBanner />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, background: "linear-gradient(135deg, #e2e8f0, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "-0.3px", marginBottom: 4 }}>
            🗂 Projects
          </h1>
          <p style={{ color: "#475569", fontSize: 14 }}>Manage your projects and collaborate with your team</p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={openCreate}
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 10, fontWeight: 600, height: 40 }}
        >
          New Project
        </Button>
      </div>

      {/* Stats */}
      <div className="projects-stats" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { label: "Total", count: projects.length, color: "#6366f1" },
          { label: "Active", count: projects.filter((p) => p.status === "ACTIVE" || !p.status).length, color: "#22c55e" },
          { label: "Owned", count: projects.filter((p) => p.myRole === "OWNER").length, color: "#f59e0b" },
          { label: "Shared", count: projects.filter((p) => p.myRole !== "OWNER").length, color: "#8b5cf6" },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: "#16161d", border: "1px solid #1e1e2a", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, boxShadow: `0 0 8px ${s.color}60` }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>{s.count}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spin size="large" /></div>
      ) : projects.length === 0 ? (
        <div style={{ background: "#16161d", border: "1px solid #1e1e2a", borderRadius: 16, padding: "60px 20px", textAlign: "center" }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: "#475569" }}>No projects yet. Create your first project!</span>}>
            <Button type="primary" icon={<Plus size={16} />} onClick={openCreate} style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8 }}>
              Create Project
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="projects-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {projects.map((project) => {
            const taskCount = project._count?.tasks || 0;
            const sprintCount = project._count?.sprints || 0;
            const memberCount = project._count?.members || 1;
            const color = project.color || "#6366f1";
            const statusColor = getStatusColor(project.status);
            const isOwner = project.myRole === "OWNER";
            const canEdit = project.myRole === "OWNER" || project.myRole === "ADMIN";

            return (
              <div
                key={project.id}
                className="glass-card"
                style={{ borderRadius: 16, overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${color}20`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
              >
                {/* Color bar */}
                <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}80)` }} />

                <div style={{ padding: 20 }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}20`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Folder size={18} color={color} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0", lineHeight: 1.2, display: "flex", alignItems: "center", gap: 6 }}>
                          {project.name}
                          {isOwner && <Crown size={12} color="#f59e0b" />}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <Tag style={{ fontSize: 10, padding: "0 6px", borderRadius: 4, background: `${statusColor}15`, border: `1px solid ${statusColor}30`, color: statusColor }}>
                            {project.status || "ACTIVE"}
                          </Tag>
                          <Tag style={{ fontSize: 10, padding: "0 6px", borderRadius: 4, background: "#6366f115", border: "1px solid #6366f130", color: "#6366f1" }}>
                            {project.myRole}
                          </Tag>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 4 }}>
                      {canEdit && (
                        <Tooltip title="Edit"><Button size="small" type="text" icon={<Edit3 size={13} />} onClick={(e) => { e.stopPropagation(); openEdit(project); }} style={{ color: "#6366f1" }} /></Tooltip>
                      )}
                      {isOwner && (
                        <Popconfirm title="Delete this project?" description="All tasks will be unlinked." onConfirm={(e) => { e?.stopPropagation(); deleteMutation.mutate(project.id); }} okText="Delete" okButtonProps={{ danger: true }}>
                          <Button size="small" type="text" icon={<Trash2 size={13} />} onClick={(e) => e.stopPropagation()} style={{ color: "#ef4444" }} />
                        </Popconfirm>
                      )}
                    </div>
                  </div>

                  {project.description && (
                    <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {project.description}
                    </p>
                  )}

                  {/* Stats + Members */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
                        <Layers size={12} color="#475569" /> {taskCount} tasks
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
                        <Kanban size={12} color="#475569" /> {sprintCount} sprints
                      </div>
                    </div>
                    {/* Member avatars */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <Avatar.Group max={{ count: 3, style: { background: "#374151", color: "#94a3b8", fontSize: 10 } }} size={24}>
                        {(project.members || []).map((m) => (
                          <Tooltip key={m.id} title={`${m.user.name} (${m.role})`}>
                            <Avatar size={24} src={m.user.avatar} style={{ background: "#6366f1", fontSize: 10 }}>
                              {m.user.name[0].toUpperCase()}
                            </Avatar>
                          </Tooltip>
                        ))}
                      </Avatar.Group>
                      <span style={{ color: "#64748b", fontSize: 11, marginLeft: 6 }}>{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      size="small"
                      icon={<Kanban size={12} />}
                      onClick={() => navigate(`/kanban?project=${project.id}`)}
                      style={{ flex: 1, borderColor: `${color}40`, color: color, borderRadius: 8, fontSize: 12 }}
                    >
                      Kanban
                    </Button>
                    <Button
                      size="small"
                      icon={<Users size={12} />}
                      onClick={() => setTeamModalProject(project)}
                      style={{ borderColor: "#374151", color: "#94a3b8", borderRadius: 8, fontSize: 12 }}
                    >
                      Team
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        title={<div style={{ display: "flex", alignItems: "center", gap: 10, color: "#e2e8f0" }}><Folder size={18} color="#6366f1" />{editingProject ? "Edit Project" : "New Project"}</div>}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        okText={editingProject ? "Update" : "Create"}
        okButtonProps={{ style: { background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, fontWeight: 600 }, loading: createMutation.isPending || updateMutation.isPending }}
        styles={{ content: { background: "#16161d", border: "1px solid #2a2a3a", borderRadius: 16 }, header: { background: "#16161d", borderBottom: "1px solid #1e1e2a" }, footer: { background: "#16161d", borderTop: "1px solid #1e1e2a" }, mask: { backdropFilter: "blur(4px)" } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="name" label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Project Name</span>} rules={[{ required: true, message: "Name is required" }]}>
            <Input placeholder="e.g. Product Redesign Q1" style={{ background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 8, color: "#e2e8f0" }} />
          </Form.Item>
          <Form.Item name="description" label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Description</span>}>
            <Input.TextArea placeholder="What is this project about?" rows={3} style={{ background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 8, color: "#e2e8f0" }} />
          </Form.Item>
          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="color" label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Color</span>} style={{ flex: 1 }}>
              <Select style={{ borderRadius: 8 }} options={PROJECT_COLORS.map((c) => ({ value: c, label: (<div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />{c}</div>) }))} />
            </Form.Item>
            {editingProject && (
              <Form.Item name="status" label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Status</span>} style={{ flex: 1 }}>
                <Select style={{ borderRadius: 8 }} options={[{ value: "ACTIVE", label: "Active" }, { value: "ON_HOLD", label: "On Hold" }, { value: "COMPLETED", label: "Completed" }, { value: "ARCHIVED", label: "Archived" }]} />
              </Form.Item>
            )}
          </div>
        </Form>
      </Modal>

      {/* Team Management Modal */}
      {teamModalProject && (
        <TeamManagementModal
          project={teamModalProject}
          open={!!teamModalProject}
          onClose={() => setTeamModalProject(null)}
        />
      )}
    </div>
  );
}
