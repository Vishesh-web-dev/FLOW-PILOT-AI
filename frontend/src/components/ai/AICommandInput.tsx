import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Spin } from "antd";
import { Bot, Send, Sparkles, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { aiApi } from "../../api/ai.api";
import { AICommandResponse } from "../../types";
import { AI_COMMAND_EXAMPLES } from "../../utils/helpers";
import AIResponseCard from "./AIResponseCard";

interface AICommandInputProps {
  onCommandExecuted?: (response: AICommandResponse) => void;
  projectId?: string;
  sprintId?: string;
  compact?: boolean;
}

export default function AICommandInput({
  onCommandExecuted,
  projectId,
  sprintId,
  compact = false,
}: AICommandInputProps) {
  const [command, setCommand] = useState("");
  const [showExamples, setShowExamples] = useState(false);
  const [lastResponse, setLastResponse] = useState<AICommandResponse | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (cmd: string) =>
      aiApi.processCommand({ command: cmd, projectId, sprintId }),
    onSuccess: (response) => {
      const data = response.data.data;
      if (data) {
        setLastResponse(data);
        onCommandExecuted?.(data);
        toast.success(data.aiResult.message || "✅ Command executed successfully!");

        // Invalidate relevant queries based on action type
        const type = data.aiResult.type;
        if (["CREATE_TASK", "CREATE_TASKS", "BREAKDOWN_TASK"].includes(type)) {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["task-stats"] });
          queryClient.invalidateQueries({ queryKey: ["activities"] });
        }
        if (type === "CREATE_REMINDER") {
          queryClient.invalidateQueries({ queryKey: ["reminders"] });
          queryClient.invalidateQueries({ queryKey: ["activities"] });
        }
        if (type === "CREATE_SPRINT") {
          queryClient.invalidateQueries({ queryKey: ["sprints"] });
          queryClient.invalidateQueries({ queryKey: ["activities"] });
        }
        if (type === "SUMMARIZE") {
          queryClient.invalidateQueries({ queryKey: ["activities"] });
        }
      }
      setCommand("");
    },
    onError: (error: unknown) => {
      // Extract error message from the API response body if available
      let message = "Failed to process command. Check your AI API key.";
      if (
        error &&
        typeof error === "object" &&
        "response" in error
      ) {
        const axiosErr = error as { response?: { data?: { message?: string; error?: string } } };
        message =
          axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
    },
  });

  const handleSubmit = () => {
    const trimmed = command.trim();
    if (!trimmed || mutation.isPending) return;
    mutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleExampleClick = (example: string) => {
    setCommand(example);
    setShowExamples(false);
    inputRef.current?.focus();
  };

  const randomExamples = AI_COMMAND_EXAMPLES.slice(0, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Main Input */}
      <div
        className="ai-input-glow"
        style={{
          background: "#16161d",
          border: "1px solid #2a2a3a",
          borderRadius: 16,
          padding: 4,
          transition: "all 0.2s ease",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px 8px",
            borderBottom: "1px solid #1e1e2a",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 12px rgba(99,102,241,0.4)",
              flexShrink: 0,
            }}
          >
            <Bot size={14} color="white" />
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              background: "linear-gradient(135deg, #a5b4fc, #c4b5fd)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            FlowPilot AI Command
          </span>
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 11,
              color: "#3b3b52",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <kbd
              style={{
                padding: "2px 6px",
                background: "#1c1c28",
                border: "1px solid #2a2a3a",
                borderRadius: 4,
                fontSize: 10,
                color: "#64748b",
              }}
            >
              Enter
            </kbd>
            <span style={{ color: "#3b4060" }}>to send</span>
          </div>
        </div>

        {/* Text area */}
        <div style={{ padding: "8px 16px", position: "relative" }}>
          <textarea
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowExamples(false)}
            placeholder={
              compact
                ? "Type a command... (e.g., 'Create task for auth bug')"
                : "Type a command... e.g., 'Create 3 backend tasks for auth module' or 'Remind me to deploy on Friday'"
            }
            rows={compact ? 1 : 2}
            disabled={mutation.isPending}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#e2e8f0",
              fontSize: 15,
              fontFamily: "Inter, sans-serif",
              resize: "none",
              lineHeight: 1.6,
              caretColor: "#6366f1",
            }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px 8px",
          }}
        >
          <button
            type="button"
            onClick={() => setShowExamples(!showExamples)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#475569",
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 6,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#a5b4fc";
              (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#475569";
              (e.currentTarget as HTMLElement).style.background = "none";
            }}
          >
            <Sparkles size={12} />
            Examples
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {mutation.isPending && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6366f1" }}>
                <Spin size="small" />
                <span style={{ fontSize: 12 }}>AI Processing...</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!command.trim() || mutation.isPending}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background:
                  !command.trim() || mutation.isPending
                    ? "#1c1c28"
                    : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: 8,
                cursor: !command.trim() || mutation.isPending ? "not-allowed" : "pointer",
                color:
                  !command.trim() || mutation.isPending ? "#3b4060" : "#fff",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.2s ease",
                boxShadow:
                  command.trim() && !mutation.isPending
                    ? "0 0 12px rgba(99,102,241,0.3)"
                    : "none",
              }}
            >
              <Send size={14} />
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Examples Panel */}
      {showExamples && (
        <div
          className="animate-fade-in-up"
          style={{
            background: "#16161d",
            border: "1px solid #1e1e2a",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            💡 Try these commands
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: compact ? "1fr" : "1fr 1fr",
              gap: 8,
            }}
          >
            {randomExamples.map((example, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(example)}
                style={{
                  background: "#1c1c28",
                  border: "1px solid #2a2a3a",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  color: "#94a3b8",
                  fontSize: 13,
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#6366f1";
                  (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
                  (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.05)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#2a2a3a";
                  (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                  (e.currentTarget as HTMLElement).style.background = "#1c1c28";
                }}
              >
                <ChevronRight size={12} style={{ flexShrink: 0, color: "#6366f1" }} />
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Response Card */}
      {lastResponse && (
        <AIResponseCard
          response={lastResponse}
          onDismiss={() => setLastResponse(null)}
        />
      )}
    </div>
  );
}
