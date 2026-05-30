import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Spin,
  Tag,
  Popconfirm,
  Tabs,
  Empty,
} from "antd";
import { useState } from "react";
import { remindersApi } from "../api/reminders.api";
import { Reminder } from "../types";
import {
  Bell,
  BellRing,
  CheckCircle,
  Trash2,
  Plus,
  Clock,
  AlertCircle,
} from "lucide-react";
import { formatDateTime, isOverdue } from "../utils/helpers";
import toast from "react-hot-toast";
import dayjs from "dayjs";

export default function RemindersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("upcoming");

  const { data, isLoading } = useQuery({
    queryKey: ["reminders"],
    queryFn: () => remindersApi.getAll(),
  });

  const allReminders: Reminder[] = data?.data?.data || [];
  const upcoming = allReminders.filter((r) => !r.isCompleted);
  const completed = allReminders.filter((r) => r.isCompleted);
  const overduePending = upcoming.filter((r) => isOverdue(r.remindAt));

  const createMutation = useMutation({
    mutationFn: remindersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder created!");
      form.resetFields();
      setModalOpen(false);
    },
    onError: () => toast.error("Failed to create reminder"),
  });

  const completeMutation = useMutation({
    mutationFn: remindersApi.complete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder marked complete!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: remindersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder deleted");
    },
  });

  const handleSubmit = (values: { title: string; description?: string; remindAt: dayjs.Dayjs }) => {
    createMutation.mutate({
      title: values.title,
      description: values.description,
      remindAt: values.remindAt.toISOString(),
    });
  };

  const ReminderCard = ({ reminder }: { reminder: Reminder }) => {
    const overdue = isOverdue(reminder.remindAt) && !reminder.isCompleted;

    return (
      <div
        style={{
          background: "#1c1c28",
          border: `1px solid ${overdue ? "rgba(239,68,68,0.3)" : "#2a2a3a"}`,
          borderRadius: 12,
          padding: 16,
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.border = `1px solid ${overdue ? "rgba(239,68,68,0.5)" : "#3a3a4a"}`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.border = `1px solid ${overdue ? "rgba(239,68,68,0.3)" : "#2a2a3a"}`;
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: reminder.isCompleted
              ? "rgba(34,197,94,0.1)"
              : overdue
              ? "rgba(239,68,68,0.1)"
              : "rgba(99,102,241,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {reminder.isCompleted ? (
            <CheckCircle size={18} color="#22c55e" />
          ) : overdue ? (
            <AlertCircle size={18} color="#ef4444" />
          ) : (
            <BellRing size={18} color="#6366f1" />
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: reminder.isCompleted ? "#475569" : "#e2e8f0",
                textDecoration: reminder.isCompleted ? "line-through" : "none",
              }}
            >
              {reminder.title}
            </span>
            {overdue && (
              <Tag color="error" style={{ fontSize: 11, margin: 0 }}>
                Overdue
              </Tag>
            )}
            {reminder.isCompleted && (
              <Tag color="success" style={{ fontSize: 11, margin: 0 }}>
                Done
              </Tag>
            )}
          </div>

          {reminder.description && (
            <p
              style={{
                fontSize: 13,
                color: "#475569",
                margin: "0 0 8px",
                lineHeight: 1.5,
              }}
            >
              {reminder.description}
            </p>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: overdue ? "#ef4444" : "#475569",
            }}
          >
            <Clock size={11} />
            <span>{formatDateTime(reminder.remindAt)}</span>
          </div>
        </div>

        {/* Actions */}
        {!reminder.isCompleted && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Button
              size="small"
              type="text"
              icon={<CheckCircle size={14} />}
              onClick={() => completeMutation.mutate(reminder.id)}
              loading={completeMutation.isPending}
              style={{ color: "#22c55e" }}
              title="Mark complete"
            />
            <Popconfirm
              title="Delete this reminder?"
              onConfirm={() => deleteMutation.mutate(reminder.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                type="text"
                icon={<Trash2 size={14} />}
                style={{ color: "#ef4444" }}
                title="Delete"
              />
            </Popconfirm>
          </div>
        )}
        {reminder.isCompleted && (
          <Popconfirm
            title="Delete this reminder?"
            onConfirm={() => deleteMutation.mutate(reminder.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              type="text"
              icon={<Trash2 size={14} />}
              style={{ color: "#475569" }}
              title="Delete"
            />
          </Popconfirm>
        )}
      </div>
    );
  };

  const tabItems = [
    {
      key: "upcoming",
      label: (
        <span>
          Upcoming{" "}
          {upcoming.length > 0 && (
            <span
              style={{
                background: "#6366f1",
                color: "#fff",
                borderRadius: 10,
                padding: "1px 6px",
                fontSize: 11,
                marginLeft: 4,
              }}
            >
              {upcoming.length}
            </span>
          )}
        </span>
      ),
      children: (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          {upcoming.length === 0 ? (
            <Empty description="No upcoming reminders" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            upcoming.map((r) => <ReminderCard key={r.id} reminder={r} />)
          )}
        </div>
      ),
    },
    {
      key: "completed",
      label: `Completed (${completed.length})`,
      children: (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          {completed.length === 0 ? (
            <Empty description="No completed reminders" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            completed.map((r) => <ReminderCard key={r.id} reminder={r} />)
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div className="reminders-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
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
            🔔 Reminders
          </h1>
          <p style={{ color: "#475569", fontSize: 14 }}>
            Stay on top of deadlines and important events
          </p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => setModalOpen(true)}
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            borderRadius: 10,
            fontWeight: 600,
            height: 40,
          }}
        >
          New Reminder
        </Button>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Upcoming", count: upcoming.length, color: "#6366f1", icon: <Bell size={18} /> },
          { label: "Overdue", count: upcoming.filter((r) => isOverdue(r.remindAt)).length, color: "#ef4444", icon: <AlertCircle size={18} /> },
          { label: "Completed", count: completed.length, color: "#22c55e", icon: <CheckCircle size={18} /> },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              flex: "1 1 120px",
              minWidth: 0,
              background: "#16161d",
              border: "1px solid #1e1e2a",
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${stat.color}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: stat.color,
                flexShrink: 0,
              }}
            >
              {stat.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>
                {stat.count}
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2, whiteSpace: "nowrap" }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        style={{
          background: "#16161d",
          border: "1px solid #1e1e2a",
          borderRadius: 16,
          padding: 24,
        }}
      >
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            style={{ color: "#94a3b8" }}
          />
        )}
      </div>

      {/* Create Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#e2e8f0" }}>
            <Bell size={18} color="#6366f1" />
            Create Reminder
          </div>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Create"
        okButtonProps={{
          style: {
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
          },
          loading: createMutation.isPending,
        }}
        styles={{
          content: { background: "#16161d", border: "1px solid #2a2a3a", borderRadius: 16 },
          header: { background: "#16161d", borderBottom: "1px solid #1e1e2a" },
          footer: { background: "#16161d", borderTop: "1px solid #1e1e2a" },
          mask: { backdropFilter: "blur(4px)" },
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Title</span>}
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input
              placeholder="What do you want to be reminded about?"
              style={{
                background: "#1c1c28",
                border: "1px solid #2a2a3a",
                borderRadius: 8,
                color: "#e2e8f0",
              }}
            />
          </Form.Item>

          <Form.Item
            name="message"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Message (optional)</span>}
          >
            <Input.TextArea
              placeholder="Additional details..."
              rows={3}
              style={{
                background: "#1c1c28",
                border: "1px solid #2a2a3a",
                borderRadius: 8,
                color: "#e2e8f0",
              }}
            />
          </Form.Item>

          <Form.Item
            name="remindAt"
            label={<span style={{ color: "#94a3b8", fontSize: 13 }}>Remind At</span>}
            rules={[{ required: true, message: "Please select a time" }]}
          >
            <DatePicker
              showTime
              style={{
                width: "100%",
                background: "#1c1c28",
                border: "1px solid #2a2a3a",
                borderRadius: 8,
                color: "#e2e8f0",
              }}
              disabledDate={(current) => current && current < dayjs().startOf("day")}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
