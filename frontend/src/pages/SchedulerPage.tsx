import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schedulerApi, ScheduleAnalytics } from "../api/scheduler.api";
import { Schedule, ScheduleItem, ScheduleLog } from "../types";
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
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toDateStr = (d: Date) => d.toISOString().split("T")[0];
const todayStr = () => toDateStr(new Date());

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
  onCreated,
}: {
  onClose: () => void;
  onCreated: (s: Schedule) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
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
      onCreated(s);
    },
    onError: () => toast.error("Failed to create schedule"),
  });

  const aiMutation = useMutation({
    mutationFn: schedulerApi.aiGenerate,
    onSuccess: (res) => {
      const s = res.data.data!;
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success(`🤖 AI created "${s.name}" with ${s.items.length} items!`);
      onCreated(s);
    },
    onError: (err: Error) => toast.error(err.message || "AI generation failed"),
  });

  const handleManualSubmit = () => {
    if (!name.trim()) { toast.error("Schedule name is required"); return; }
    const validItems = items.filter((i) => i.title.trim());
    createMutation.mutate({ name, description, type, items: validItems });
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
            New Schedule
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Mode toggle */}
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

        {mode === "ai" ? (
          <>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe your ideal schedule... e.g. 'I want a productive morning routine: wake at 6am, 30min gym, cold shower, 1hr deep work before breakfast...'"
              rows={5}
              style={{
                width: "100%", background: "#0d0d11", border: "1px solid #2a2a3a",
                borderRadius: 8, color: "#e2e8f0", padding: 12, fontSize: 14,
                resize: "vertical", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
            <button
              onClick={handleAiSubmit}
              disabled={aiMutation.isPending}
              style={{
                marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: aiMutation.isPending ? 0.7 : 1,
              }}
            >
              {aiMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Sparkles size={16} /> Generate with AI</>}
            </button>
          </>
        ) : (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Schedule name (e.g. Morning Routine)"
              style={{
                width: "100%", background: "#0d0d11", border: "1px solid #2a2a3a",
                borderRadius: 8, color: "#e2e8f0", padding: "10px 12px", fontSize: 14,
                boxSizing: "border-box", marginBottom: 10,
              }}
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              style={{
                width: "100%", background: "#0d0d11", border: "1px solid #2a2a3a",
                borderRadius: 8, color: "#e2e8f0", padding: "10px 12px", fontSize: 14,
                boxSizing: "border-box", marginBottom: 10,
              }}
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")}
              style={{
                width: "100%", background: "#0d0d11", border: "1px solid #2a2a3a",
                borderRadius: 8, color: "#e2e8f0", padding: "10px 12px", fontSize: 14,
                boxSizing: "border-box", marginBottom: 16,
              }}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>

            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>Schedule items</p>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input
                  value={item.title}
                  onChange={(e) => {
                    const copy = [...items];
                    copy[idx].title = e.target.value;
                    setItems(copy);
                  }}
                  placeholder={`Item ${idx + 1} (e.g. Wake up)`}
                  style={{
                    flex: 1, background: "#0d0d11", border: "1px solid #2a2a3a",
                    borderRadius: 8, color: "#e2e8f0", padding: "8px 10px", fontSize: 13,
                  }}
                />
                <input
                  value={item.timeOfDay}
                  onChange={(e) => {
                    const copy = [...items];
                    copy[idx].timeOfDay = e.target.value;
                    setItems(copy);
                  }}
                  placeholder="08:00"
                  type="time"
                  style={{
                    width: 90, background: "#0d0d11", border: "1px solid #2a2a3a",
                    borderRadius: 8, color: "#e2e8f0", padding: "8px 8px", fontSize: 13,
                  }}
                />
                <select
                  value={item.category}
                  onChange={(e) => {
                    const copy = [...items];
                    copy[idx].category = e.target.value;
                    setItems(copy);
                  }}
                  style={{
                    width: 110, background: "#0d0d11", border: "1px solid #2a2a3a",
                    borderRadius: 8, color: "#e2e8f0", padding: "8px 6px", fontSize: 12,
                  }}
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
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
            <button
              onClick={handleManualSubmit}
              disabled={createMutation.isPending}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
                opacity: createMutation.isPending ? 0.7 : 1,
              }}
            >
              {createMutation.isPending ? "Creating..." : "Create Schedule"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Daily Check-in View ──────────────────────────────────────────────────────

function DailyCheckIn({ schedule }: { schedule: Schedule }) {
  const [dateStr, setDateStr] = useState(todayStr());
  const qc = useQueryClient();

  const logsQuery = useQuery({
    queryKey: ["schedule-logs", schedule.id, dateStr],
    queryFn: () => schedulerApi.getLogs(schedule.id, dateStr),
    select: (res) => res.data.data ?? [],
  });

  const toggleMutation = useMutation({
    mutationFn: (data: { itemId: string; isDone: boolean }) =>
      schedulerApi.toggleLog(schedule.id, { itemId: data.itemId, date: dateStr, isDone: data.isDone }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-logs", schedule.id, dateStr] });
    },
    onError: () => toast.error("Failed to update"),
  });

  const logs = logsQuery.data ?? [];
  const getLog = (itemId: string): ScheduleLog | undefined =>
    logs.find((l) => l.scheduleItemId === itemId);

  const doneCount = logs.filter((l) => l.isDone).length;
  const totalCount = schedule.items.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const prevDay = () => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    setDateStr(toDateStr(d));
  };
  const nextDay = () => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    setDateStr(toDateStr(d));
  };
  const isToday = dateStr === todayStr();

  return (
    <div>
      {/* Date navigator */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, justifyContent: "center" }}>
        <button
          onClick={prevDay}
          style={{ background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 8, padding: "6px 10px", color: "#94a3b8", cursor: "pointer" }}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 15 }}>
            {isToday ? "Today" : new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </div>
          <div style={{ color: "#64748b", fontSize: 12 }}>{dateStr}</div>
        </div>
        <button
          onClick={nextDay}
          disabled={isToday}
          style={{
            background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 8,
            padding: "6px 10px", color: isToday ? "#2a2a3a" : "#94a3b8",
            cursor: isToday ? "not-allowed" : "pointer",
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
                <div style={{ flex: 1 }}>
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
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  {item.timeOfDay && (
                    <span style={{ color: "#6366f1", fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}>
                      <Clock size={11} />{item.timeOfDay}
                    </span>
                  )}
                  <CategoryBadge category={item.category} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Analytics View ───────────────────────────────────────────────────────────

function AnalyticsView({ schedule }: { schedule: Schedule }) {
  const [days, setDays] = useState(30);

  const analyticsQuery = useQuery({
    queryKey: ["schedule-analytics", schedule.id, days],
    queryFn: () => schedulerApi.getAnalytics(schedule.id, days),
    select: (res) => res.data.data as ScheduleAnalytics,
  });

  const data = analyticsQuery.data;

  return (
    <div>
      {/* Days filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "1px solid",
              borderColor: days === d ? "#6366f1" : "#2a2a3a",
              background: days === d ? "rgba(99,102,241,0.15)" : "transparent",
              color: days === d ? "#a5b4fc" : "#64748b",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}
          >
            {d}d
          </button>
        ))}
      </div>

      {analyticsQuery.isLoading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
          Loading analytics...
        </div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Overall Rate", value: `${data.overallRate}%`, icon: <Target size={18} />, color: "#6366f1" },
              { label: "Completed", value: data.totalDone, icon: <CheckCircle2 size={18} />, color: "#10b981" },
              { label: "Days Tracked", value: data.days, icon: <TrendingUp size={18} />, color: "#f59e0b" },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  background: "#1c1c28", border: "1px solid #2a2a3a",
                  borderRadius: 12, padding: 16, textAlign: "center",
                }}
              >
                <div style={{ color: card.color, marginBottom: 8 }}>{card.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>{card.value}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Daily bar chart (simple CSS bars) */}
          <div style={{ background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 12px", fontWeight: 600 }}>Daily Completion Rate</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, overflowX: "auto" }}>
              {data.dailyStats.slice(-days).map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.done}/${day.total} (${day.rate}%)`}
                  style={{
                    flex: "0 0 auto", minWidth: days <= 14 ? 24 : 12,
                    height: `${Math.max(day.rate, 4)}%`,
                    background: day.rate === 100 ? "#10b981" : day.rate > 50 ? "#6366f1" : "#2a2a3a",
                    borderRadius: "2px 2px 0 0", transition: "height 0.3s",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ color: "#4b5563", fontSize: 11 }}>{data.dailyStats[0]?.date}</span>
              <span style={{ color: "#4b5563", fontSize: 11 }}>{data.dailyStats[data.dailyStats.length - 1]?.date}</span>
            </div>
          </div>

          {/* Per-item stats */}
          <div style={{ background: "#1c1c28", border: "1px solid #2a2a3a", borderRadius: 12, padding: 16 }}>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 12px", fontWeight: 600 }}>Item Completion Rates</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.itemStats.sort((a, b) => b.rate - a.rate).map((item) => (
                <div key={item.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                    <span style={{ color: "#e2e8f0", fontSize: 13 }}>{item.title}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <CategoryBadge category={item.category} />
                      <span style={{ color: "#6366f1", fontWeight: 700, fontSize: 13 }}>{item.rate}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: "#0d0d11", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%", borderRadius: 999,
                        background: item.rate === 100 ? "#10b981" : "linear-gradient(90deg, #6366f1, #8b5cf6)",
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
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${selected.name}"?`)) {
                      deleteMutation.mutate(selected.id);
                    }
                  }}
                  style={{
                    background: "none", border: "1px solid #2a2a3a", borderRadius: 8,
                    color: "#ef4444", cursor: "pointer", padding: "6px 10px",
                    display: "flex", alignItems: "center", gap: 4, fontSize: 13,
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>
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

      {showModal && (
        <ScheduleModal
          onClose={() => setShowModal(false)}
          onCreated={(s) => { setSelectedId(s.id); setShowModal(false); }}
        />
      )}
    </div>
  );
}
