import { useEffect, useState } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Tag,
  Space,
  Avatar,
} from "antd";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { Task, TaskStatus, Priority, CreateTaskForm } from "../../types";
import { tasksApi } from "../../api/tasks.api";
import { projectsApi } from "../../api/projects.api";
import { sprintsApi } from "../../api/sprints.api";
import { teamApi } from "../../api/team.api";
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
} from "../../utils/helpers";

const { TextArea } = Input;

interface TaskModalProps {
  open: boolean;
  task: Task | null;
  defaultStatus?: TaskStatus;
  projectId?: string;
  sprintId?: string;
  onClose: () => void;
}

export default function TaskModal({
  open,
  task,
  defaultStatus = "TODO",
  projectId,
  sprintId,
  onClose,
}: TaskModalProps) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const isEditing = !!task;

  // Track selected projectId in form to fetch members
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId || task?.projectId || undefined);

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.getAll,
    enabled: open,
  });

  const { data: sprintsData } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => sprintsApi.getAll(),
    enabled: open,
  });

  const { data: membersData } = useQuery({
    queryKey: ["team-members", selectedProjectId],
    queryFn: () => teamApi.getMembers(selectedProjectId!),
    enabled: open && !!selectedProjectId,
  });

  const projects = projectsData?.data?.data || [];
  const sprints = sprintsData?.data?.data || [];
  const members = membersData?.data?.data || [];

  useEffect(() => {
    if (open) {
      if (task) {
        form.setFieldsValue({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate ? dayjs(task.dueDate) : undefined,
          labels: task.labels,
          estimatedHours: task.estimatedHours,
          projectId: task.projectId || projectId,
          sprintId: task.sprintId || sprintId,
          assigneeId: task.assigneeId || undefined,
        });
        setSelectedProjectId(task.projectId || projectId);
      } else {
        form.resetFields();
        form.setFieldsValue({
          status: defaultStatus,
          priority: "MEDIUM",
          projectId,
          sprintId,
          labels: [],
        });
        setSelectedProjectId(projectId);
      }
    }
  }, [open, task, form, defaultStatus, projectId, sprintId]);

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Task created!");
      onClose();
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => {
      // Convert null fields to undefined for compatibility with CreateTaskForm
      const fixedData: Partial<CreateTaskForm> & { position?: number } = {
        title: data.title,
        description: data.description ?? undefined,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ?? undefined,
        labels: data.labels,
        estimatedHours: data.estimatedHours ?? undefined,
        projectId: data.projectId ?? undefined,
        sprintId: data.sprintId ?? undefined,
        position: data.position,
      };
      return tasksApi.update(id, fixedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Task updated!");
      onClose();
    },
    onError: () => toast.error("Failed to update task"),
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
        labels: values.labels || [],
      };

      if (isEditing) {
        updateMutation.mutate({ id: task.id, data });
      } else {
        createMutation.mutate(data);
      }
    } catch (err) {
      // Validation failed
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const PRIORITY_COLORS: Record<Priority, string> = {
    LOW: "#6b7280",
    MEDIUM: "#f59e0b",
    HIGH: "#ef4444",
    URGENT: "#dc2626",
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{isEditing ? "✏️ Edit Task" : "➕ Create Task"}</span>
        </div>
      }
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={onClose} style={{ background: "#1c1c28", border: "1px solid #2a2a3a", color: "#94a3b8" }}>
            Cancel
          </Button>
          <Button
            type="primary"
            loading={isPending}
            onClick={handleSubmit}
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none",
            }}
          >
            {isEditing ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      }
      width={580}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {/* Title */}
        <Form.Item
          name="title"
          label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Title</span>}
          rules={[{ required: true, message: "Title is required" }]}
        >
          <Input placeholder="What needs to be done?" autoFocus />
        </Form.Item>

        {/* Description */}
        <Form.Item
          name="description"
          label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Description</span>}
        >
          <TextArea
            placeholder="Add more details..."
            rows={3}
            style={{ resize: "none" }}
          />
        </Form.Item>

        {/* Status + Priority */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item
            name="status"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Status</span>}
          >
            <Select options={STATUS_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="priority"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Priority</span>}
          >
            <Select
              options={PRIORITY_OPTIONS.map((opt) => ({
                ...opt,
                label: (
                  <Space>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: PRIORITY_COLORS[opt.value as Priority],
                        display: "inline-block",
                      }}
                    />
                    {opt.label}
                  </Space>
                ),
              }))}
            />
          </Form.Item>
        </div>

        {/* Due Date + Estimated Hours */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item
            name="dueDate"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Due Date</span>}
          >
            <DatePicker
              style={{ width: "100%" }}
              placeholder="Select due date"
              format="MMM D, YYYY"
            />
          </Form.Item>

          <Form.Item
            name="estimatedHours"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Estimated Hours</span>}
          >
            <InputNumber
              min={0.5}
              max={100}
              step={0.5}
              style={{ width: "100%" }}
              placeholder="e.g., 4"
            />
          </Form.Item>
        </div>

        {/* Labels */}
        <Form.Item
          name="labels"
          label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Labels</span>}
        >
          <Select
            mode="tags"
            style={{ width: "100%" }}
            placeholder="Add labels (press Enter)"
            tokenSeparators={[","]}
            options={[
              { value: "backend", label: "backend" },
              { value: "frontend", label: "frontend" },
              { value: "bug", label: "bug" },
              { value: "feature", label: "feature" },
              { value: "auth", label: "auth" },
              { value: "ui", label: "ui" },
              { value: "api", label: "api" },
              { value: "design", label: "design" },
              { value: "testing", label: "testing" },
              { value: "documentation", label: "documentation" },
            ]}
          />
        </Form.Item>

        {/* Project + Sprint */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Form.Item
            name="projectId"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Project</span>}
          >
            <Select
              allowClear
              placeholder="Select project"
              onChange={(val) => {
                setSelectedProjectId(val);
                form.setFieldValue("assigneeId", undefined);
              }}
              options={projects.map((p) => ({
                value: p.id,
                label: (
                  <Space>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: p.color,
                        display: "inline-block",
                      }}
                    />
                    {p.name}
                  </Space>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item
            name="sprintId"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Sprint</span>}
          >
            <Select
              allowClear
              placeholder="Select sprint"
              options={sprints.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
            />
          </Form.Item>
        </div>

        {/* Assignee — only shown when a project is selected */}
        {selectedProjectId && members.length > 0 && (
          <Form.Item
            name="assigneeId"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Assignee</span>}
          >
            <Select
              allowClear
              placeholder="Assign to a team member"
              options={members.map((m) => ({
                value: m.user.id,
                label: (
                  <Space>
                    <Avatar size={18} src={m.user.avatar ?? undefined} style={{ background: "#6366f1", fontSize: 10 }}>
                      {m.user.name[0].toUpperCase()}
                    </Avatar>
                    {m.user.name}
                  </Space>
                ),
              }))}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
