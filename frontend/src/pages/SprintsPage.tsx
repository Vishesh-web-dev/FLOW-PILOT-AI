import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Progress, Badge, Tag, Empty, Modal, Form, Input, Select, DatePicker, Spin, Tooltip } from "antd";
import { Plus, Zap, Calendar, Target, Trash2, Edit3, CheckCircle2, Clock } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { sprintsApi } from "../api/sprints.api";
import { projectsApi } from "../api/projects.api";
import { Sprint } from "../types";
import { formatDate, formatRelativeTime } from "../utils/helpers";
import AICommandInput from "../components/ai/AICommandInput";

const STATUS_CONFIG = {
  PLANNING: { label: "Planning", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  ACTIVE: { label: "Active", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  COMPLETED: { label: "Completed", color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
};

export default function SprintsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => sprintsApi.getAll(),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.getAll,
  });

  const sprints: Sprint[] = data?.data?.data || [];
  const projects = projectsData?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: sprintsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint created!");
      setShowModal(false);
      form.resetFields();
    },
    onError: () => toast.error("Failed to create sprint"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => sprintsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint updated!");
      setShowModal(false);
      setEditingSprint(null);
    },
    onError: () => toast.error("Failed to update sprint"),
  });

  const deleteMutation = useMutation({
    mutationFn: sprintsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint deleted");
    },
    onError: () => toast.error("Failed to delete sprint"),
  });

  const handleOpenModal = (sprint?: Sprint) => {
    if (sprint) {
      setEditingSprint(sprint);
      form.setFieldsValue({
        name: sprint.name,
        goal: sprint.goal,
        status: sprint.status,
        projectId: sprint.projectId,
        startDate: sprint.startDate ? dayjs(sprint.startDate) : undefined,
        endDate: sprint.endDate ? dayjs(sprint.endDate) : undefined,
      });
    } else {
      setEditingSprint(null);
      form.resetFields();
      form.setFieldsValue({ status: "PLANNING" });
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
      };
      if (editingSprint) {
        updateMutation.mutate({ id: editingSprint.id, data });
      } else {
        createMutation.mutate(data);
      }
    } catch {}
  };

  return (
    <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
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
            ⚡ Sprints
          </h1>
          <p style={{ color: "#475569", fontSize: 14 }}>
            Plan and track your development sprints
          </p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => handleOpenModal()}
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            borderRadius: 10,
            height: 38,
            fontWeight: 600,
          }}
        >
          New Sprint
        </Button>
      </div>

      {/* AI Command Input */}
      <AICommandInput
        onCommandExecuted={() => queryClient.invalidateQueries({ queryKey: ["sprints"] })}
        compact
      />

      {/* Sprints Grid */}
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : sprints.length === 0 ? (
        <div
          style={{
            background: "#16161d",
            border: "1px solid #1e1e2a",
            borderRadius: 16,
            padding: 60,
            textAlign: "center",
          }}
        >
          <Empty
            description={
              <span style={{ color: "#475569" }}>
                No sprints yet. Create your first sprint or use AI to generate one!
              </span>
            }
          />
          <Button
            type="primary"
            style={{ marginTop: 16, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none" }}
            onClick={() => handleOpenModal()}
          >
            Create First Sprint
          </Button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {sprints.map((sprint) => {
            const statusConf = STATUS_CONFIG[sprint.status];
            const totalTasks = sprint._count?.tasks || sprint.tasks?.length || 0;
            const completedTasks =
              sprint.tasks?.filter((t) => t.status === "DONE").length || 0;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const isExpired =
              sprint.endDate && new Date(sprint.endDate) < new Date();

            return (
              <div
                key={sprint.id}
                className="animate-fade-in-up"
                style={{
                  background: "#16161d",
                  border: "1px solid #1e1e2a",
                  borderRadius: 16,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  transition: "all 0.2s ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#2a2a3a";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#1e1e2a";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {/* Sprint Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Zap size={16} color={statusConf.color} />
                      <h3
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: "#e2e8f0",
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sprint.name}
                      </h3>
                    </div>
                    <Tag
                      style={{
                        background: statusConf.bg,
                        border: `1px solid ${statusConf.color}30`,
                        color: statusConf.color,
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {statusConf.label}
                    </Tag>
                  </div>

                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <Tooltip title="Edit sprint">
                      <button
                        onClick={() => handleOpenModal(sprint)}
                        style={{
                          background: "none",
                          border: "1px solid #2a2a3a",
                          borderRadius: 6,
                          padding: "4px 6px",
                          cursor: "pointer",
                          color: "#64748b",
                          display: "flex",
                        }}
                      >
                        <Edit3 size={12} />
                      </button>
                    </Tooltip>
                    <Tooltip title="Delete sprint">
                      <button
                        onClick={() => {
                          Modal.confirm({
                            title: "Delete Sprint",
                            content: "Are you sure? Tasks will be unassigned.",
                            okText: "Delete",
                            okButtonProps: { danger: true },
                            onOk: () => deleteMutation.mutate(sprint.id),
                          });
                        }}
                        style={{
                          background: "none",
                          border: "1px solid #2a2a3a",
                          borderRadius: 6,
                          padding: "4px 6px",
                          cursor: "pointer",
                          color: "#64748b",
                          display: "flex",
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* Goal */}
                {sprint.goal && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Target size={13} color="#475569" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, margin: 0 }}>
                      {sprint.goal}
                    </p>
                  </div>
                )}

                {/* Dates */}
                {(sprint.startDate || sprint.endDate) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                    {sprint.startDate && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#475569" }}>
                        <Calendar size={11} />
                        {formatDate(sprint.startDate, "MMM D")}
                      </div>
                    )}
                    {sprint.startDate && sprint.endDate && (
                      <span style={{ color: "#2a2a3a" }}>→</span>
                    )}
                    {sprint.endDate && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          color: isExpired && sprint.status !== "COMPLETED" ? "#ef4444" : "#475569",
                        }}
                      >
                        <Clock size={11} />
                        {formatDate(sprint.endDate, "MMM D")}
                        {isExpired && sprint.status !== "COMPLETED" && (
                          <span style={{ color: "#ef4444", fontSize: 10 }}>(Overdue)</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Progress */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "#64748b" }}>
                      {completedTasks}/{totalTasks} tasks
                    </span>
                    <span
                      style={{
                        color: progress === 100 ? "#10b981" : "#6366f1",
                        fontWeight: 600,
                      }}
                    >
                      {progress}%
                    </span>
                  </div>
                  <Progress
                    percent={progress}
                    showInfo={false}
                    strokeColor={progress === 100 ? "#10b981" : "linear-gradient(90deg, #6366f1, #8b5cf6)"}
                    trailColor="#1e1e2a"
                    size="small"
                    style={{ margin: 0 }}
                  />
                </div>

                {/* Project */}
                {sprint.project && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: sprint.project.color,
                      }}
                    />
                    <span style={{ fontSize: 12, color: "#475569" }}>
                      {sprint.project.name}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sprint Modal */}
      <Modal
        open={showModal}
        onCancel={() => { setShowModal(false); setEditingSprint(null); }}
        title={editingSprint ? "✏️ Edit Sprint" : "⚡ New Sprint"}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => setShowModal(false)} style={{ background: "#1c1c28", border: "1px solid #2a2a3a", color: "#94a3b8" }}>Cancel</Button>
            <Button
              type="primary"
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit}
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none" }}
            >
              {editingSprint ? "Save Changes" : "Create Sprint"}
            </Button>
          </div>
        }
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Sprint Name</span>}
            rules={[{ required: true, message: "Sprint name is required" }]}
          >
            <Input placeholder="e.g., Sprint 1 — Authentication" autoFocus />
          </Form.Item>

          <Form.Item
            name="goal"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Sprint Goal</span>}
          >
            <Input.TextArea placeholder="What do you want to achieve in this sprint?" rows={2} style={{ resize: "none" }} />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item
              name="startDate"
              label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Start Date</span>}
            >
              <DatePicker style={{ width: "100%" }} format="MMM D, YYYY" />
            </Form.Item>

            <Form.Item
              name="endDate"
              label={<span style={{ color: "#94a3b8", fontSize: 13 }}>End Date</span>}
            >
              <DatePicker style={{ width: "100%" }} format="MMM D, YYYY" />
            </Form.Item>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item
              name="status"
              label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Status</span>}
            >
              <Select
                options={[
                  { value: "PLANNING", label: "Planning" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "COMPLETED", label: "Completed" },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="projectId"
              label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Project</span>}
            >
              <Select
                allowClear
                placeholder="Select project"
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
