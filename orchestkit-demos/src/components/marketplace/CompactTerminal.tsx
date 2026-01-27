import React from "react";
import { spring, interpolate } from "remotion";

/**
 * CompactTerminal - Right-side terminal panel for split view
 * Optimized for 60% width display with dense information layout
 * Glass-morphism panels with inset borders and subtle glow
 */

const SLAM = { stiffness: 300, damping: 15 };
const BOUNCE = { stiffness: 200, damping: 12 };

// Colors
const GREEN = "#22c55e";
const PURPLE = "#a855f7";
const CYAN = "#06b6d4";
const YELLOW = "#f59e0b";
const PINK = "#ec4899";
const RED = "#ef4444";
const WHITE = "#e6edf3";
const DIM = "#8b949e";


export interface TerminalConfig {
  command: string;
  commandCount: string;
  title: string;
  agents?: { name: string; color: string; progress: number }[];
  tasks?: { text: string; done: boolean }[];
  score?: { value: number; label: string };
  metrics?: { label: string; value: string; color: string }[];
}

interface CompactTerminalProps {
  frame: number;
  fps: number;
  config: TerminalConfig;
}

// Compact agent row
const AgentRow: React.FC<{
  agent: { name: string; color: string; progress: number };
  frame: number;
  fps: number;
  delay: number;
}> = ({ agent, frame, fps, delay }) => {
  const rowFrame = Math.max(0, frame - delay);
  const progress = spring({ frame: rowFrame, fps, config: SLAM });
  const barWidth = interpolate(
    spring({ frame: Math.max(0, rowFrame - 3), fps, config: BOUNCE }),
    [0, 1],
    [0, agent.progress]
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        transform: `translateX(${interpolate(progress, [0, 1], [-15, 0])}px)`,
        opacity: progress,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: agent.color,
          boxShadow: `0 0 6px ${agent.color}`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color: WHITE, fontWeight: 500, width: 90, flexShrink: 0 }}>
        {agent.name}
      </span>
      <div
        style={{
          flex: 1,
          height: 4,
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${barWidth}%`,
            height: "100%",
            backgroundColor: agent.color,
            borderRadius: 2,
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: DIM, width: 30, textAlign: "right" }}>
        {Math.round(barWidth)}%
      </span>
    </div>
  );
};

// Compact task row
const TaskRow: React.FC<{
  task: { text: string; done: boolean };
  frame: number;
  fps: number;
  delay: number;
}> = ({ task, frame, fps, delay }) => {
  const rowFrame = Math.max(0, frame - delay);
  const progress = spring({ frame: rowFrame, fps, config: SLAM });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        transform: `translateX(${interpolate(progress, [0, 1], [-15, 0])}px)`,
        opacity: progress,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          backgroundColor: task.done ? GREEN : "transparent",
          border: `1.5px solid ${task.done ? GREEN : DIM}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {task.done && (
          <span style={{ color: "#000", fontSize: 9, fontWeight: 700 }}>✓</span>
        )}
      </div>
      <span
        style={{
          fontSize: 12,
          color: task.done ? WHITE : DIM,
        }}
      >
        {task.text}
      </span>
    </div>
  );
};

// Compact score display
const CompactScore: React.FC<{
  score: { value: number; label: string };
  frame: number;
  fps: number;
}> = ({ score, frame, fps }) => {
  const counterFrame = Math.max(0, frame - 10);
  const progress = spring({ frame: counterFrame, fps, config: BOUNCE });
  const displayValue = interpolate(progress, [0, 1], [0, score.value]);

  const getScoreColor = (val: number) => {
    if (val >= 9) return GREEN;
    if (val >= 7) return YELLOW;
    if (val >= 5) return CYAN;
    return RED;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 4,
        transform: `scale(${spring({ frame: Math.max(0, frame - 8), fps, config: SLAM })})`,
      }}
    >
      <span
        style={{
          fontSize: 36,
          fontWeight: 900,
          color: getScoreColor(displayValue),
          fontFamily: "SF Mono, Monaco, monospace",
          textShadow: `0 0 15px ${getScoreColor(displayValue)}66`,
        }}
      >
        {displayValue.toFixed(1)}
      </span>
      <span style={{ fontSize: 16, color: DIM }}>/10</span>
      <span style={{ fontSize: 10, color: DIM, marginLeft: 8, letterSpacing: 1 }}>
        {score.label}
      </span>
    </div>
  );
};

// Metric pill
const MetricPill: React.FC<{
  metric: { label: string; value: string; color: string };
  frame: number;
  fps: number;
  delay: number;
}> = ({ metric, frame, fps, delay }) => {
  const pillFrame = Math.max(0, frame - delay);
  const scale = spring({ frame: pillFrame, fps, config: SLAM });

  return (
    <div
      style={{
        backgroundColor: `${metric.color}22`,
        border: `1px solid ${metric.color}44`,
        borderRadius: 4,
        padding: "4px 10px",
        transform: `scale(${scale})`,
        opacity: scale,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: metric.color }}>
        {metric.value}
      </span>
      <span style={{ fontSize: 9, color: DIM, letterSpacing: 0.5 }}>
        {metric.label}
      </span>
    </div>
  );
};

export const CompactTerminal: React.FC<CompactTerminalProps> = ({
  frame,
  fps,
  config,
}) => {
  // Panel entrance
  const panelProgress = spring({ frame, fps, config: SLAM });

  // Typing animation
  const typedChars = Math.min(
    config.command.length,
    Math.floor((frame / fps) * 20)
  );
  const typedCommand = config.command.slice(0, typedChars);
  const showCursor = frame % 18 < 12;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(13, 17, 23, 0.9)",
        fontFamily: "SF Mono, Monaco, Consolas, monospace",
        opacity: panelProgress,
      }}
    >
      {/* LEFT COLUMN: YOU TYPE (40%) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "40%",
          bottom: 0,
          backgroundColor: "rgba(22, 27, 34, 0.85)",
          borderRight: `1px solid rgba(48, 54, 61, 0.8)`,
          padding: "16px 16px",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,0.03)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Window controls + label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 14,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: RED }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: YELLOW }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: GREEN }} />
          <span style={{ marginLeft: 10, fontSize: 10, color: DIM, letterSpacing: 1 }}>
            YOU TYPE
          </span>
        </div>

        {/* Command line */}
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.4)",
            borderRadius: 6,
            padding: "10px 12px",
          }}
        >
          <span style={{ color: GREEN, fontSize: 14 }}>$ </span>
          <span style={{ color: WHITE, fontSize: 14 }}>{typedCommand}</span>
          {showCursor && typedChars < config.command.length && (
            <span style={{ color: GREEN, opacity: 0.8 }}>█</span>
          )}
        </div>

        {/* Command count */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 12,
            fontSize: 11,
            color: DIM,
          }}
        >
          <span style={{ color: PURPLE }}>●</span>
          <span>{config.commandCount}</span>
        </div>

        {/* Decorative dim lines */}
        <div style={{ marginTop: "auto", opacity: 0.2 }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 6,
                width: `${70 - i * 12}%`,
                backgroundColor: DIM,
                borderRadius: 3,
                marginBottom: 6,
              }}
            />
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: ORCHESTKIT OUTPUT (60%) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "40%",
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(22, 27, 34, 0.8)",
          padding: "16px 16px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: PURPLE,
              boxShadow: `0 0 8px ${PURPLE}`,
            }}
          />
          <span style={{ fontSize: 10, color: DIM, letterSpacing: 1 }}>
            ORCHESTKIT OUTPUT
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: WHITE,
            marginBottom: 14,
            letterSpacing: 0.5,
          }}
        >
          {config.title}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Agents */}
          {config.agents && config.agents.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {config.agents.map((agent, idx) => (
                <AgentRow
                  key={agent.name}
                  agent={agent}
                  frame={frame}
                  fps={fps}
                  delay={5 + idx * 3}
                />
              ))}
            </div>
          )}

          {/* Tasks */}
          {config.tasks && config.tasks.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {config.tasks.map((task, idx) => (
                <TaskRow
                  key={idx}
                  task={task}
                  frame={frame}
                  fps={fps}
                  delay={6 + idx * 4}
                />
              ))}
            </div>
          )}

          {/* Metrics */}
          {config.metrics && config.metrics.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {config.metrics.map((metric, idx) => (
                <MetricPill
                  key={metric.label}
                  metric={metric}
                  frame={frame}
                  fps={fps}
                  delay={8 + idx * 2}
                />
              ))}
            </div>
          )}
        </div>

        {/* Score at bottom */}
        {config.score && (
          <div style={{ marginTop: "auto", paddingTop: 10 }}>
            <CompactScore score={config.score} frame={frame} fps={fps} />
          </div>
        )}
      </div>
    </div>
  );
};

// Terminal configurations (same as before)
export const TERMINAL_CONFIGS: Record<string, TerminalConfig> = {
  context: {
    command: "/load-context",
    commandCount: "1 of 8 commands",
    title: "LOADING PROJECT CONTEXT",
    agents: [
      { name: "Explore", color: CYAN, progress: 100 },
      { name: "Memory", color: PURPLE, progress: 85 },
    ],
    tasks: [
      { text: "Reading CLAUDE.md", done: true },
      { text: "Scanning codebase", done: true },
      { text: "Loading memories", done: true },
    ],
    metrics: [
      { label: "FILES", value: "847", color: CYAN },
      { label: "PATTERNS", value: "42", color: PURPLE },
    ],
  },
  plan: {
    command: "/brainstorming auth",
    commandCount: "2 of 8 commands",
    title: "PARALLEL BRAINSTORMING",
    agents: [
      { name: "Architect", color: PURPLE, progress: 100 },
      { name: "Backend", color: CYAN, progress: 90 },
      { name: "Security", color: RED, progress: 75 },
      { name: "UX", color: PINK, progress: 60 },
    ],
    tasks: [
      { text: "Generating ideas", done: true },
      { text: "Feasibility check", done: true },
      { text: "Trade-off analysis", done: false },
    ],
  },
  build: {
    command: "/implement user-auth",
    commandCount: "3 of 8 commands",
    title: "SPAWNING BUILD AGENTS",
    agents: [
      { name: "Backend", color: CYAN, progress: 100 },
      { name: "Frontend", color: GREEN, progress: 85 },
      { name: "Tests", color: YELLOW, progress: 70 },
      { name: "Database", color: PURPLE, progress: 55 },
    ],
    metrics: [
      { label: "AGENTS", value: "8", color: PURPLE },
      { label: "PARALLEL", value: "4", color: GREEN },
    ],
  },
  code: {
    command: "/implement --continue",
    commandCount: "4 of 8 commands",
    title: "WRITING CODE",
    tasks: [
      { text: "auth.service.ts", done: true },
      { text: "login.component.tsx", done: true },
      { text: "auth.middleware.py", done: true },
      { text: "user.model.py", done: false },
    ],
    metrics: [
      { label: "LINES", value: "1,247", color: GREEN },
      { label: "FILES", value: "12", color: CYAN },
      { label: "TESTS", value: "34", color: YELLOW },
    ],
  },
  security: {
    command: "/verify --security",
    commandCount: "5 of 8 commands",
    title: "SECURITY AUDIT",
    agents: [
      { name: "Auditor", color: RED, progress: 100 },
      { name: "Scanner", color: YELLOW, progress: 100 },
    ],
    tasks: [
      { text: "OWASP Top 10", done: true },
      { text: "Secrets scan", done: true },
      { text: "CVE database", done: true },
      { text: "Input validation", done: true },
    ],
    score: { value: 9.2, label: "SECURITY" },
  },
  quality: {
    command: "/verify user-auth",
    commandCount: "6 of 8 commands",
    title: "QUALITY VERIFICATION",
    agents: [
      { name: "Quality", color: GREEN, progress: 100 },
      { name: "Tests", color: YELLOW, progress: 100 },
      { name: "Types", color: CYAN, progress: 100 },
    ],
    metrics: [
      { label: "COVERAGE", value: "94%", color: GREEN },
      { label: "PASSING", value: "34/34", color: GREEN },
    ],
    score: { value: 9.4, label: "QUALITY" },
  },
  review: {
    command: "/review-pr 187",
    commandCount: "7 of 8 commands",
    title: "PR REVIEW",
    agents: [
      { name: "Reviewer", color: PURPLE, progress: 100 },
      { name: "Security", color: RED, progress: 100 },
      { name: "Tests", color: YELLOW, progress: 100 },
    ],
    tasks: [
      { text: "Architecture", done: true },
      { text: "Security patterns", done: true },
      { text: "Test coverage", done: true },
      { text: "Documentation", done: true },
    ],
    score: { value: 8.9, label: "REVIEW" },
  },
  learn: {
    command: "/remember decision",
    commandCount: "8 of 8 commands",
    title: "STORING KNOWLEDGE",
    agents: [
      { name: "Memory", color: PURPLE, progress: 100 },
      { name: "Graph", color: CYAN, progress: 85 },
    ],
    tasks: [
      { text: "Extracting patterns", done: true },
      { text: "Building relations", done: true },
      { text: "Storing in graph", done: true },
    ],
    metrics: [
      { label: "NODES", value: "6", color: PURPLE },
      { label: "EDGES", value: "8", color: CYAN },
    ],
  },
};
