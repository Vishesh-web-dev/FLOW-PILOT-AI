import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Popconfirm, TimePicker, Select, Input, DatePicker } from "antd";
import dayjs from "dayjs";
import { schedulerApi, ScheduleAnalytics } from "../api/scheduler.api";
import { Schedule, ScheduleItem, ScheduleLog, ScheduleType } from "../types";
import {
  CalendarCheck,
  Plus,
  Trash2,
  Sparkles,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Tag,
  Edit2,
  X,
  Bot,
  Loader2,
  TrendingUp,
  Target,
  Flame,
  Zap,
  Activity,
  CalendarRange,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Always use the browser's local timezone so dates match what the user sees
const getUserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// Format a Date as "YYYY-MM-DD" in the user's local timezone (not UTC)
const toDateStr = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: getUserTz() }).format(d);

// "YYYY-MM-DD" for today in local timezone
const todayStr = () => toDateStr(new Date());

// ── Schedule type-aware period helpers ───────────────────────────────────────

function getPeriodKey(type: ScheduleType, d: Date): string {
  if (type === "MONTHLY") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (type === "WEEKLY") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const mon = new Date(d);
    mon.setDate(diff);
    mon.setHours(0, 0, 0, 0);
    return toDateStr(mon);
  }
  return toDateStr(d);
}

function getPeriodLabel(type: ScheduleType, key: string): string {
  const d = new Date(key + "T12:00:00");
  if (type === "MONTHLY") {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  if (type === "WEEKLY") {
    const end = new Date(d);
    end.setDate(d.getDate() + 6);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return "";
}

const CATEGORY_COLORS: Record<string, string> = {
  health: "#10b981",
  work: "#6366f1",
  personal: "#f59e0b",
  learning: "#3b82f6",
  fitness: "#ec4899",
  mindfulness: "#8b5cf6",
};

const CATEGORY_LABELS: Record<string, string> = {
  health: "Health",
  work: "Work",
  personal: "Personal",
  learning: "Learning",
  fitness: "Fitness",
  mindfulness: "Mindfulness",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return null;
  const color = CATEGORY_COLORS[category] || "#64748b";
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
      }}
    >
      <Tag size={9} />
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

// ─── Create / Edit Schedule Modal ─────────────────────────────────────────────

function ScheduleModal({
  onClose,
  onSaved,
  editSchedule,
}: {
  onClose: () => void;
  onSaved: (s: Schedule) => void;
  editSchedule?: Schedule;
}) {
  const isEdit = !!editSchedule;
  const [name, setName] = useState(editSchedule?.name ?? "");
  const [description, setDescription] = useState(editSchedule?.description ?? "");
  const [type, setType] = useState<"DAILY" | "WEEKLY" | "MONTHLY">(editSchedule?.type ?? "DAILY");
  const [aiPrompt, setAiPrompt] = useState("");
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [items, setItems] = useState<{ title: string; timeOfDay: string; category: string }[]>([
    { title: "", timeOfDay: "", category: "personal" },
  ]);

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: schedulerApi.create,
    onSuccess: (res) => {
      const s = res.data.data!;
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(`✅ Schedule "${s.name}" created!`);
      onSaved(s);
    },
    onError: () => toast.error("Failed to create schedule"),
  });

  const updateScheduleMutation = useMutation({
    mutationFn: () => schedulerApi.update(editSchedule!.id, { name, description, type }),
    onSuccess: (res) => {
      const s = res.data.data!;
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(`Schedule "${s.name}" updated!`);
      onSaved(s);
    },
    onError: () => toast.error("Failed to update schedule"),
  });

  const aiMutation = useMutation({
    mutationFn: schedulerApi.aiGenerate,
    onSuccess: (res) => {
      const s = res.data.data!;
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(`🤖 AI created "${s.name}" with ${s.items.length} items!`);
      onSaved(s);
    },
    onError: (err: Error) => toast.error(err.message || "AI generation failed"),
  });

  const isPending = createMutation.isPending || updateScheduleMutation.isPending || aiMutation.isPending;

  const handleManualSubmit = () => {
    if (!name.trim()) { toast.error("Schedule name is required"); return; }
    if (isEdit) {
      updateScheduleMutation.mutate();
    } else {
      const validItems = items.filter((i) => i.title.trim());
      createMutation.mutate({ name, description, type, items: validItems });
    }
  };

  const handleAiSubmit = () => {
    if (!aiPrompt.trim()) { toast.error("Please describe your schedule"); return; }
    aiMutation.mutate(aiPrompt);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#13131a", border: "1px solid #2a2a3a", borderRadius: 16,
          width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 28,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: 20, fontWeight: 700 }}>
            {isEdit ? "Edit Schedule" : "New Schedule"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Mode toggle — create only */}
        {!isEdit && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["manual", "ai"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid",
                  borderColor: mode === m ? "#6366f1" : "#2a2a3a",
                  background: mode === m ? "rgba(99,102,241,0.15)" : "transparent",
                  color: mode === m ? "#a5b4fc" : "#64748b",
                  cursor: "pointer", fontWeight: 600, fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {m === "ai" ? <><Bot size={14} /> AI Generate</> : <><Edit2 size={14} /> Manual</>}
              </button>
            ))}
          </div>
        )}

        {!isEdit && mode === "ai" ? (
          <>
            <Input.TextArea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe your ideal schedule... e.g. 'I want a productive morning routine: wake at 6am, 30min gym, cold shower, 1hr deep work before breakfast...'"
              rows={5}
              style={{ resize: "vertical" }}
            />
            <button
              onClick={handleAiSubmit}
              disabled={isPending}
              style={{
                marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Sparkles size={16} /> Generate with AI</>}
            </button>
          </>
        ) : (
          <>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Schedule name (e.g. Morning Routine)"
              style={{ marginBottom: 10 }}
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              style={{ marginBottom: 10 }}
            />
            <Select
              value={type}
              onChange={(val) => setType(val)}
              style={{ width: "100%", marginBottom: 16 }}
              options={[
                { label: "Daily", value: "DAILY" },
                { label: "Weekly", value: "WEEKLY" },
                { label: "Monthly", value: "MONTHLY" },
              ]}
              popupMatchSelectWidth
            />

            {/* Items — create only */}
            {!isEdit && (
              <>
                <p style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>Schedule items</p>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <Input
                      value={item.title}
                      onChange={(e) => {
                        const copy = [...items];
                        copy[idx].title = e.target.value;
                        setItems(copy);
                      }}
                      placeholder={`Item ${idx + 1} (e.g. Wake up)`}
                      style={{ flex: 1 }}
                    />
                    <TimePicker
                      value={item.timeOfDay ? dayjs(item.timeOfDay, "HH:mm") : null}
                      onChange={(val) => {
                        const copy = [...items];
                        copy[idx].timeOfDay = val ? val.format("HH:mm") : "";
                        setItems(copy);
                      }}
                      format="HH:mm"
                      allowClear
                      placeholder="Time"
                      placement="bottomLeft"
                      popupStyle={{ zIndex: 1100 }}
                      style={{ width: 110 }}
                    />
                    <Select
                      value={item.category}
                      onChange={(val) => {
                        const copy = [...items];
                        copy[idx].category = val;
                        setItems(copy);
                      }}
                      style={{ width: 120 }}
                      popupMatchSelectWidth={false}
                      options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k }))}
                    />
                    {items.length > 1 && (
                      <button
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setItems([...items, { title: "", timeOfDay: "", category: "personal" }])}
                  style={{
                    background: "none", border: "1px dashed #2a2a3a", color: "#64748b",
                    borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, width: "100%",
                    marginBottom: 16,
                  }}
                >
                  + Add item
                </button>
              </>
            )}
            <button
              onClick={handleManualSubmit}
              disabled={isPending}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending
                ? (isEdit ? "Saving..." : "Creating...")
                : (isEdit ? "Save Changes" : "Create Schedule")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Edit Item Modal ──────────────────────────────────────────────────────────

function EditItemModal({
  scheduleId,
  item,
  onClose,
}: {
  scheduleId: string;
  item: ScheduleItem;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [timeOfDay, setTimeOfDay] = useState(item.timeOfDay ?? "");
  const [category, setCategory] = useState(item.category ?? "personal");

  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: () =>
      schedulerApi.updateItem(scheduleId, item.id, { title, description: description || null, timeOfDay: timeOfDay || null, category }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Item updated");
      onClose();
    },
    onError: () => toast.error("Failed to update item"),
  });

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    updateMutation.mutate();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#13131a", border: "1px solid #2a2a3a", borderRadius: 16,
          width: "100%", maxWidth: 460, padding: 28,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Edit2 size={18} color="#6366f1" /> Edit Item
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Title <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Item title"
            />
          </div>

          <div>
            <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Time
              </label>
              <TimePicker
                value={timeOfDay ? dayjs(timeOfDay, "HH:mm") : null}
                onChange={(val) => setTimeOfDay(val ? val.format("HH:mm") : "")}
                format="HH:mm"
                allowClear
                placeholder="HH:MM"
                placement="bottomLeft"
                popupStyle={{ zIndex: 1200 }}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Category
              </label>
              <Select
                value={category}
                onChange={(val) => setCategory(val)}
                style={{ width: "100%" }}
                popupMatchSelectWidth={false}
                dropdownStyle={{ zIndex: 1200 }}
                options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ label: v, value: k }))}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 8,
              background: "transparent", border: "1px solid #2a2a3a",
              color: "#64748b", fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            style={{
              flex: 2, padding: "11px 0", borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
              opacity: updateMutation.isPending ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {updateMutation.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
              : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Daily Check-in View ──────────────────────────────────────────────────────

function DailyCheckIn({ schedule }: { schedule: Schedule }) {
  const currentPeriodKey = getPeriodKey(schedule.type, new Date());
  const [periodKey, setPeriodKey] = useState(currentPeriodKey);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const qc = useQueryClient();

  const isCurrentPeriod = periodKey === currentPeriodKey;

  const logsQuery = useQuery({
    queryKey: ["schedule-logs", schedule.id, periodKey],
    queryFn: () => schedulerApi.getLogs(schedule.id, periodKey),
    select: (res) => res.data.data ?? [],
  });

  const toggleMutation = useMutation({
    mutationFn: (data: { itemId: string; isDone: boolean }) =>
      schedulerApi.toggleLog(schedule.id, { itemId: data.itemId, date: periodKey, isDone: data.isDone }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-logs", schedule.id, periodKey] });
      qc.invalidateQueries({ queryKey: ["schedule-item-stats", schedule.id] });
    },
    onError: () => toast.error("Failed to update"),
  });

  // All-time per-item stats: use a far-past from so logs before createdAt
  // (e.g. back-filled days) are also captured. Cache key uses today's date
  // so invalidation on toggle + day-change both work.
  const allTimeFrom = "2000-01-01";
  const allTimeTo = todayStr();
  const itemStatsQuery = useQuery({
    queryKey: ["schedule-item-stats", schedule.id, allTimeTo],
    queryFn: () => schedulerApi.getAnalytics(schedule.id, { from: allTimeFrom, to: allTimeTo }),
    select: (res) => Object.fromEntries((res.data.data?.itemStats ?? []).map((s) => [s.id, s])),
  });

  const logs = logsQuery.data ?? [];
  const getLog = (itemId: string): ScheduleLog | undefined =>
    logs.find((l) => l.scheduleItemId === itemId);

  const doneCount = logs.filter((l) => l.isDone).length;
  const totalCount = schedule.items.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const movePeriod = (dir: number) => {
    const d = new Date(periodKey + "T12:00:00");
    if (schedule.type === "MONTHLY") d.setMonth(d.getMonth() + dir);
    else if (schedule.type === "WEEKLY") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setPeriodKey(getPeriodKey(schedule.type, d));
  };

  const periodDisplayLabel = () => {
    if (schedule.type === "DAILY") {
      if (isCurrentPeriod) return "Today";
      return new Date(periodKey + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "short", day: "numeric",
      });
    }
    if (schedule.type === "MONTHLY") return getPeriodLabel("MONTHLY", periodKey);
    if (schedule.type === "WEEKLY") return isCurrentPeriod ? "This Week" : getPeriodLabel("WEEKLY", periodKey);
    return periodKey;
  };

  const periodSubLabel = () => {
    if (schedule.type === "DAILY") {
      // Show a human-readable date as sub-label (not raw YYYY-MM-DD)
      const d = new Date(periodKey + "T12:00:00");
      return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }
    if (schedule.type === "WEEKLY") return getPeriodLabel("WEEKLY", periodKey);
    return "";
  };

  const completionUnit = schedule.type === "MONTHLY" ? "mo" : schedule.type === "WEEKLY" ? "wk" : "d";

  return (
    <div>
      {/* Period navigator */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, justifyContent: "center" }}>
        <button
          onClick={() => movePeriod(-1)}
          style={{ background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 8, padding: "6px 10px", color: "#94a3b8", cursor: "pointer" }}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: "center", minWidth: 160 }}>
          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 15 }}>
            {periodDisplayLabel()}
          </div>
          {periodSubLabel() && (
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{periodSubLabel()}</div>
          )}
        </div>
        <button
          onClick={() => movePeriod(1)}
          disabled={isCurrentPeriod}
          style={{
            background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 8,
            padding: "6px 10px", color: isCurrentPeriod ? "#2a2a3a" : "#94a3b8",
            cursor: isCurrentPeriod ? "not-allowed" : "pointer",
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>{doneCount} / {totalCount} completed</span>
          <span style={{ color: pct === 100 ? "#10b981" : "#6366f1", fontWeight: 700, fontSize: 13 }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: "#1c1c28", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              height: "100%", borderRadius: 999, transition: "width 0.4s ease",
              background: pct === 100 ? "#10b981" : "linear-gradient(90deg, #6366f1, #8b5cf6)",
              width: `${pct}%`,
            }}
          />
        </div>
      </div>

      {/* Items */}
      {logsQuery.isLoading ? (
        <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
          Loading...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {schedule.items.map((item) => {
            const log = getLog(item.id);
            const isDone = log?.isDone ?? false;
            const stats = itemStatsQuery.data?.[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleMutation.mutate({ itemId: item.id, isDone: !isDone })}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  background: isDone ? "rgba(16,185,129,0.06)" : "#1c1c28",
                  border: `1px solid ${isDone ? "rgba(16,185,129,0.25)" : "#2a2a3a"}`,
                  borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                  opacity: toggleMutation.isPending ? 0.7 : 1,
                }}
              >
                {isDone
                  ? <CheckCircle2 size={20} color="#10b981" />
                  : <Circle size={20} color="#4b5563" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: isDone ? "#64748b" : "#e2e8f0",
                    textDecoration: isDone ? "line-through" : "none",
                    fontSize: 14, fontWeight: 500,
                  }}>
                    {item.title}
                  </div>
                  {item.description && (
                    <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{item.description}</div>
                  )}
                  {stats && stats.doneDays > 0 && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5,
                      background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)",
                      borderRadius: 6, padding: "2px 7px",
                    }}>
                      <span style={{ color: "#10b981", fontSize: 10, fontWeight: 700 }}>✓</span>
                      <span style={{ color: "#94a3b8", fontSize: 11 }}>
                        {stats.doneDays}<span style={{ color: "#4b5563" }}>/{stats.totalDays}{completionUnit}</span>
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  {item.timeOfDay && (
                    <span style={{ color: "#6366f1", fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}>
                      <Clock size={11} />{item.timeOfDay}
                    </span>
                  )}
                  <CategoryBadge category={item.category} />
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}
                    title="Edit item"
                    style={{
                      background: "none", border: "none", color: "#4b5563",
                      cursor: "pointer", padding: "2px 4px",
                      display: "flex", alignItems: "center", flexShrink: 0,
                      borderRadius: 4,
                    }}
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingItem && (
        <EditItemModal
          scheduleId={schedule.id}
          item={editingItem}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}

// ─── Analytics View ───────────────────────────────────────────────────────────

function AnalyticsView({ schedule }: { schedule: Schedule }) {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(29, "day"),
    dayjs(),
  ]);
  const [activePreset, setActivePreset] = useState<number | null>(30);

  const fromStr = dateRange[0].format("YYYY-MM-DD");
  const toStr   = dateRange[1].format("YYYY-MM-DD");

  const analyticsQuery = useQuery({
    queryKey: ["schedule-analytics", schedule.id, fromStr, toStr],
    queryFn:  () => schedulerApi.getAnalytics(schedule.id, { from: fromStr, to: toStr }),
    select:   (res) => res.data.data as ScheduleAnalytics,
  });

  const setPreset = (days: number) => {
    setActivePreset(days);
    setDateRange([dayjs().subtract(days - 1, "day"), dayjs()]);
  };

  const data = analyticsQuery.data;
  const numDays = data?.days ?? 30;

  return (
    <div>
      {/* ── Date range controls ── */}
      <div style={{ marginBottom: 20 }}>
        {/* Quick preset pills */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {[
            { label: "7d", days: 7 },
            { label: "30d", days: 30 },
            { label: "90d", days: 90 },
            { label: "6m", days: 180 },
            { label: "1y", days: 365 },
          ].map((p) => (
            <button
              key={p.days}
              onClick={() => setPreset(p.days)}
              style={{
                padding: "4px 12px", borderRadius: 6, border: "1px solid",
                borderColor: activePreset === p.days ? "#6366f1" : "#2a2a3a",
                background: activePreset === p.days ? "rgba(99,102,241,0.18)" : "transparent",
                color: activePreset === p.days ? "#a5b4fc" : "#64748b",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* Date range picker */}
        <DatePicker.RangePicker
          value={dateRange}
          onChange={(vals) => {
            if (vals && vals[0] && vals[1]) {
              setActivePreset(null);
              setDateRange([vals[0], vals[1]]);
            }
          }}
          disabledDate={(d) => d.isAfter(dayjs())}
          allowClear={false}
          style={{
            background: "#1c1c28", border: "1px solid #2a2a3a",
            borderRadius: 8, width: "100%",
          }}
          popupStyle={{ zIndex: 1200 }}
        />
      </div>

      {analyticsQuery.isLoading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
          Loading analytics…
        </div>
      ) : !data ? null : (
        <>
          {/* ── Summary cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Overall Rate",     value: `${data.overallRate}%`,    icon: <Target size={17} />,    color: "#6366f1" },
              { label: "Total Done",       value: data.totalDone,             icon: <CheckCircle2 size={17} />, color: "#10b981" },
              { label: "Days Tracked",     value: data.days,                  icon: <Activity size={17} />,  color: "#f59e0b" },
              { label: "Consistency",      value: data.totalExpected > 0
                  ? `${Math.round((data.totalDone / data.totalExpected) * 100)}%`
                  : "—",                                                        icon: <TrendingUp size={17} />, color: "#3b82f6" },
              { label: "Current Streak 🔥", value: `${data.currentStreak}d`, icon: <Flame size={17} />,     color: "#f97316" },
              { label: "Longest Streak ⚡", value: `${data.longestStreak}d`, icon: <Zap size={17} />,       color: "#a78bfa" },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: "#1c1c28", border: "1px solid #2a2a3a",
                  borderRadius: 10, padding: "12px 14px",
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <div style={{ color: card.color, flexShrink: 0 }}>{card.icon}</div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Daily completion chart ── */}
          <div style={{ background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 12px", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <CalendarRange size={14} /> Daily Completion
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, overflowX: "auto", paddingBottom: 2 }}>
              {data.dailyStats.map((day) => {
                const hasData = day.total > 0;
                const barHeight = hasData ? `${Math.max(day.rate, 8)}%` : "4px";
                const barColor = !hasData ? "#2d2d3f"
                  : day.rate === 100 ? "#10b981"
                  : day.rate > 66 ? "#6366f1"
                  : day.rate > 33 ? "#f59e0b"
                  : "#ef4444";
                const barWidth = numDays <= 14 ? 24 : numDays <= 30 ? 12 : numDays <= 90 ? 8 : 4;
                return (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.done}/${day.total} (${day.rate}%)`}
                    style={{
                      flex: "0 0 auto", width: barWidth, minWidth: barWidth,
                      height: barHeight, background: barColor,
                      borderRadius: "2px 2px 0 0", transition: "height 0.3s",
                      opacity: hasData ? 1 : 0.35,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, gap: 6 }}>
              <span style={{ color: "#4b5563", fontSize: 10 }}>{data.from}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {[["#10b981","100%"],["#6366f1",">66%"],["#f59e0b",">33%"],["#ef4444","<33%"]].map(([c,l]) => (
                  <span key={l} style={{ fontSize: 9, color: "#4b5563", display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ width: 8, height: 8, background: c, borderRadius: 2, display: "inline-block" }} />{l}
                  </span>
                ))}
              </div>
              <span style={{ color: "#4b5563", fontSize: 10 }}>{data.to}</span>
            </div>
          </div>

          {/* ── Day-of-week breakdown ── */}
          <div style={{ background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 14px", fontWeight: 600 }}>Day-of-Week Performance</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.dowStats.map((d) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#64748b", fontSize: 12, width: 30, flexShrink: 0 }}>{d.name}</span>
                  <div style={{ flex: 1, height: 8, background: "#0d0d11", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%", borderRadius: 999, transition: "width 0.4s",
                        background: d.rate === 100 ? "#10b981"
                          : d.rate > 66 ? "#6366f1"
                          : d.rate > 33 ? "#f59e0b"
                          : d.total === 0 ? "#1c1c28" : "#ef4444",
                        width: `${d.rate}%`,
                      }}
                    />
                  </div>
                  <span style={{ color: d.total === 0 ? "#3a3a4a" : "#94a3b8", fontSize: 12, width: 36, textAlign: "right", flexShrink: 0 }}>
                    {d.total === 0 ? "—" : `${d.rate}%`}
                  </span>
                  {d.total > 0 && (
                    <span style={{ color: "#4b5563", fontSize: 10, flexShrink: 0 }}>
                      {d.done}/{d.total}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Per-item stats ── */}
          <div style={{ background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 12, padding: 16 }}>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 12px", fontWeight: 600 }}>Item Completion Rates</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[...data.itemStats].sort((a, b) => b.rate - a.rate).map((item) => (
                <div key={item.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                    <span style={{ color: "#e2e8f0", fontSize: 13, flex: 1, marginRight: 8 }}>{item.title}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      <CategoryBadge category={item.category} />
                      <span style={{ color: "#64748b", fontSize: 11 }}>{item.doneDays}/{item.totalDays}d</span>
                      <span style={{
                        color: item.rate >= 80 ? "#10b981" : item.rate >= 50 ? "#6366f1" : "#f59e0b",
                        fontWeight: 700, fontSize: 13, minWidth: 36, textAlign: "right",
                      }}>{item.rate}%</span>
                    </div>
                  </div>
                  <div style={{ height: 5, background: "#0d0d11", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%", borderRadius: 999,
                        background: item.rate === 100 ? "#10b981"
                          : item.rate >= 80 ? "linear-gradient(90deg,#10b981,#6366f1)"
                          : "linear-gradient(90deg,#6366f1,#8b5cf6)",
                        width: `${item.rate}%`, transition: "width 0.4s",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SchedulerPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"checkin" | "analytics">("checkin");
  const qc = useQueryClient();

  const schedulesQuery = useQuery({
    queryKey: ["schedules"],
    queryFn: schedulerApi.getAll,
    select: (res) => res.data.data ?? [],
  });

  const deleteMutation = useMutation({
    mutationFn: schedulerApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setSelectedId(null);
      toast.success("Schedule deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      schedulerApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const schedules = schedulesQuery.data ?? [];
  const selected = useMemo(() => schedules.find((s) => s.id === selectedId) ?? null, [schedules, selectedId]);

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d11", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ color: "#e2e8f0", fontSize: 26, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <CalendarCheck size={26} color="#6366f1" /> Scheduler
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: "6px 0 0" }}>
            Build habits, track your day, and stay productive.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", borderRadius: 10, color: "#fff", fontWeight: 600,
            fontSize: 14, cursor: "pointer",
          }}
        >
          <Plus size={16} /> New Schedule
        </button>
      </div>

      {schedulesQuery.isLoading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px" }} />
          Loading schedules...
        </div>
      ) : schedules.length === 0 ? (
        <div
          style={{
            textAlign: "center", padding: 80, background: "#13131a",
            border: "1px dashed #2a2a3a", borderRadius: 16, color: "#64748b",
          }}
        >
          <CalendarCheck size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <h3 style={{ color: "#94a3b8", margin: "0 0 8px" }}>No schedules yet</h3>
          <p style={{ margin: "0 0 20px", fontSize: 14 }}>
            Create your first schedule manually or let AI build one from your description.
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "10px 24px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", borderRadius: 8, color: "#fff", fontWeight: 600, cursor: "pointer",
            }}
          >
            Create Schedule
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "start" }}>
          {/* Sidebar list */}
          <div style={{ background: "#13131a", border: "1px solid #1e1e2a", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e2a" }}>
              <p style={{ color: "#64748b", fontSize: 12, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                My Schedules ({schedules.length})
              </p>
            </div>
            {schedules.map((s) => {
              const isActive = selectedId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setTab("checkin"); }}
                  style={{
                    padding: "14px 16px", cursor: "pointer",
                    background: isActive ? "rgba(99,102,241,0.1)" : "transparent",
                    borderLeft: `3px solid ${isActive ? "#6366f1" : "transparent"}`,
                    borderBottom: "1px solid #1e1e2a", transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: isActive ? "#a5b4fc" : "#e2e8f0", fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                        {s.name}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{
                          fontSize: 11, color: "#64748b",
                          background: "#1c1c28", padding: "2px 6px", borderRadius: 4,
                        }}>
                          {s.type}
                        </span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>
                          {s._count?.items ?? s.items.length} items
                        </span>
                      </div>
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActiveMutation.mutate({ id: s.id, isActive: !s.isActive });
                      }}
                      title={s.isActive ? "Active — click to pause" : "Paused — click to activate"}
                      style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                        background: s.isActive ? "#10b981" : "#374151",
                        cursor: "pointer",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main panel */}
          {selected ? (
            <div style={{ background: "#13131a", border: "1px solid #1e1e2a", borderRadius: 14, padding: 24 }}>
              {/* Schedule header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h2 style={{ color: "#e2e8f0", margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
                    {selected.name}
                  </h2>
                  {selected.description && (
                    <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{selected.description}</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setEditingSchedule(selected)}
                    style={{
                      background: "none", border: "1px solid #2a2a3a", borderRadius: 8,
                      color: "#a5b4fc", cursor: "pointer", padding: "6px 10px",
                      display: "flex", alignItems: "center", gap: 4, fontSize: 13,
                    }}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <Popconfirm
                    title={`Delete "${selected.name}"?`}
                    description="This will permanently remove the schedule and all its logs."
                    onConfirm={() => deleteMutation.mutate(selected.id)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancel"
                  >
                    <button
                      style={{
                        background: "none", border: "1px solid #2a2a3a", borderRadius: 8,
                        color: "#ef4444", cursor: "pointer", padding: "6px 10px",
                        display: "flex", alignItems: "center", gap: 4, fontSize: 13,
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </Popconfirm>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid #1e1e2a", paddingBottom: 12 }}>
                {([
                  { key: "checkin", label: "Daily Check-in", icon: <CheckCircle2 size={14} /> },
                  { key: "analytics", label: "Analytics", icon: <BarChart2 size={14} /> },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", borderRadius: 8, border: "none",
                      background: tab === t.key ? "rgba(99,102,241,0.15)" : "transparent",
                      color: tab === t.key ? "#a5b4fc" : "#64748b",
                      cursor: "pointer", fontWeight: 600, fontSize: 13,
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {tab === "checkin" && <DailyCheckIn schedule={selected} />}
              {tab === "analytics" && <AnalyticsView schedule={selected} />}
            </div>
          ) : (
            <div style={{
              background: "#13131a", border: "1px solid #1e1e2a", borderRadius: 14,
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: 60, color: "#64748b", textAlign: "center",
            }}>
              <CalendarCheck size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 15 }}>Select a schedule to get started</p>
            </div>
          )}
        </div>
      )}

      {(showModal || editingSchedule) && (
        <ScheduleModal
          onClose={() => { setShowModal(false); setEditingSchedule(null); }}
          onSaved={(s) => { setSelectedId(s.id); setShowModal(false); setEditingSchedule(null); }}
          editSchedule={editingSchedule ?? undefined}
        />
      )}
    </div>
  );
}
