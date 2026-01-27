import React from "react";
import { AbsoluteFill, spring, interpolate } from "remotion";

/**
 * KineticTerminal - Two-column terminal layout with SLAM physics
 * Left: YOU TYPE (command input)
 * Right: ORCHESTKIT OUTPUT (agent grids, task lists, progress, scores)
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
const BG = "#0d1117";
const PANEL_BG = "#161b22";
const BORDER = "#30363d";

// Terminal content configuration for each skill
export interface TerminalConfig {
  command: string;
  commandCount: string;
  title: string;
  agents?: { name: string; color: string; progress: number }[];
  tasks?: { text: string; done: boolean }[];
  score?: { value: number; label: string };
  metrics?: { label: string; value: string; color: string }[];
}

interface KineticTerminalProps {
  frame: number;
  fps: number;
  config: TerminalConfig;
}

// Agent card with progress bar
const AgentCard: React.FC<{
  agent: { name: string; color: string; progress: number };
  frame: number;
  fps: number;
  delay: number;
}> = ({ agent, frame, fps, delay }) => {
  const cardFrame = Math.max(0, frame - delay);
  const scale = spring({ frame: cardFrame, fps, config: SLAM });
  const progressWidth = interpolate(
    spring({ frame: Math.max(0, cardFrame - 5), fps, config: BOUNCE }),
    [0, 1],
    [0, agent.progress]
  );

  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 8,
        padding: "8px 12px",
        transform: `scale(${scale})`,
        opacity: scale,
        border: `1px solid ${agent.color}33`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: agent.color,
            boxShadow: `0 0 8px ${agent.color}`,
          }}
        />
        <span style={{ fontSize: 12, color: WHITE, fontWeight: 600 }}>
          {agent.name}
        </span>
      </div>
      <div
        style={{
          height: 4,
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progressWidth}%`,
            height: "100%",
            backgroundColor: agent.color,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};

// Task item with checkmark
const TaskItem: React.FC<{
  task: { text: string; done: boolean };
  frame: number;
  fps: number;
  delay: number;
}> = ({ task, frame, fps, delay }) => {
  const itemFrame = Math.max(0, frame - delay);
  const progress = spring({ frame: itemFrame, fps, config: SLAM });
  const checkFrame = Math.max(0, itemFrame - 8);
  const checkProgress = spring({ frame: checkFrame, fps, config: BOUNCE });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        transform: `translateX(${interpolate(progress, [0, 1], [-20, 0])}px)`,
        opacity: progress,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          backgroundColor: task.done ? GREEN : "transparent",
          border: `2px solid ${task.done ? GREEN : DIM}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${task.done ? checkProgress : 1})`,
        }}
      >
        {task.done && (
          <span
            style={{
              color: "#000",
              fontSize: 12,
              fontWeight: 700,
              opacity: checkProgress,
            }}
          >
            ✓
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: 14,
          color: task.done ? WHITE : DIM,
          textDecoration: task.done ? "none" : "none",
        }}
      >
        {task.text}
      </span>
    </div>
  );
};

// Rolling score counter
const ScoreCounter: React.FC<{
  score: { value: number; label: string };
  frame: number;
  fps: number;
}> = ({ score, frame, fps }) => {
  const counterFrame = Math.max(0, frame - 15);
  const progress = spring({ frame: counterFrame, fps, config: BOUNCE });
  const displayValue = interpolate(progress, [0, 1], [0, score.value]);

  // Determine color based on score
  const getScoreColor = (val: number) => {
    if (val >= 9) return GREEN;
    if (val >= 7) return YELLOW;
    if (val >= 5) return CYAN;
    return RED;
  };

  return (
    <div
      style={{
        textAlign: "center",
        transform: `scale(${spring({ frame: Math.max(0, frame - 10), fps, config: SLAM })})`,
      }}
    >
      <div
        style={{
          fontSize: 48,
          fontWeight: 900,
          color: getScoreColor(displayValue),
          fontFamily: "SF Mono, Monaco, monospace",
          textShadow: `0 0 20px ${getScoreColor(displayValue)}66`,
        }}
      >
        {displayValue.toFixed(1)}
        <span style={{ fontSize: 24, color: DIM }}>/10</span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: DIM,
          letterSpacing: 2,
          marginTop: 4,
        }}
      >
        {score.label}
      </div>
    </div>
  );
};

// Metric badge
const MetricBadge: React.FC<{
  metric: { label: string; value: string; color: string };
  frame: number;
  fps: number;
  delay: number;
}> = ({ metric, frame, fps, delay }) => {
  const badgeFrame = Math.max(0, frame - delay);
  const scale = spring({ frame: badgeFrame, fps, config: SLAM });

  return (
    <div
      style={{
        backgroundColor: `${metric.color}22`,
        border: `1px solid ${metric.color}55`,
        borderRadius: 6,
        padding: "6px 12px",
        transform: `scale(${scale})`,
        opacity: scale,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: metric.color }}>
        {metric.value}
      </div>
      <div style={{ fontSize: 10, color: DIM, letterSpacing: 1 }}>
        {metric.label}
      </div>
    </div>
  );
};

export const KineticTerminal: React.FC<KineticTerminalProps> = ({
  frame,
  fps,
  config,
}) => {
  // Panel entrance animations
  const leftPanelProgress = spring({ frame, fps, config: SLAM });
  const rightPanelProgress = spring({
    frame: Math.max(0, frame - 3),
    fps,
    config: SLAM,
  });

  // Typing animation for command
  const typedChars = Math.min(
    config.command.length,
    Math.floor((frame / fps) * 15)
  );
  const typedCommand = config.command.slice(0, typedChars);
  const showCursor = frame % 20 < 15;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        display: "flex",
        padding: 40,
        gap: 24,
        fontFamily: "SF Mono, Monaco, Consolas, monospace",
      }}
    >
      {/* LEFT PANEL: YOU TYPE */}
      <div
        style={{
          flex: "0 0 35%",
          backgroundColor: PANEL_BG,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          padding: 24,
          transform: `translateX(${interpolate(leftPanelProgress, [0, 1], [-50, 0])}px)`,
          opacity: leftPanelProgress,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: RED,
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: YELLOW,
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: GREEN,
            }}
          />
          <span
            style={{
              marginLeft: 12,
              fontSize: 12,
              color: DIM,
              letterSpacing: 2,
            }}
          >
            YOU TYPE
          </span>
        </div>

        {/* Command input */}
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.3)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <span style={{ color: GREEN, fontSize: 16 }}>$ </span>
          <span style={{ color: WHITE, fontSize: 16 }}>{typedCommand}</span>
          {showCursor && typedChars < config.command.length && (
            <span style={{ color: GREEN, opacity: 0.8 }}>█</span>
          )}
        </div>

        {/* Command count */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: DIM,
            fontSize: 14,
          }}
        >
          <span style={{ color: PURPLE }}>●</span>
          <span>{config.commandCount}</span>
        </div>

        {/* Decorative terminal lines */}
        <div style={{ marginTop: "auto", opacity: 0.3 }}>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 8,
                width: `${60 - i * 15}%`,
                backgroundColor: DIM,
                borderRadius: 4,
                marginBottom: 8,
                opacity: 0.3,
              }}
            />
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: ORCHESTKIT OUTPUT */}
      <div
        style={{
          flex: 1,
          backgroundColor: PANEL_BG,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          padding: 24,
          transform: `translateX(${interpolate(rightPanelProgress, [0, 1], [50, 0])}px)`,
          opacity: rightPanelProgress,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: PURPLE,
                boxShadow: `0 0 10px ${PURPLE}`,
              }}
            />
            <span style={{ fontSize: 12, color: DIM, letterSpacing: 2 }}>
              ORCHESTKIT OUTPUT
            </span>
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: WHITE,
            marginBottom: 20,
            letterSpacing: 1,
          }}
        >
          {config.title}
        </div>

        {/* Agent Grid */}
        {config.agents && config.agents.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {config.agents.map((agent, idx) => (
              <AgentCard
                key={agent.name}
                agent={agent}
                frame={frame}
                fps={fps}
                delay={5 + idx * 4}
              />
            ))}
          </div>
        )}

        {/* Task List */}
        {config.tasks && config.tasks.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {config.tasks.map((task, idx) => (
              <TaskItem
                key={idx}
                task={task}
                frame={frame}
                fps={fps}
                delay={8 + idx * 5}
              />
            ))}
          </div>
        )}

        {/* Metrics Row */}
        {config.metrics && config.metrics.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {config.metrics.map((metric, idx) => (
              <MetricBadge
                key={metric.label}
                metric={metric}
                frame={frame}
                fps={fps}
                delay={10 + idx * 3}
              />
            ))}
          </div>
        )}

        {/* Score (if present) */}
        {config.score && (
          <div style={{ marginTop: "auto" }}>
            <ScoreCounter score={config.score} frame={frame} fps={fps} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Pre-configured terminal content for each skill
export const TERMINAL_CONFIGS: Record<string, TerminalConfig> = {
  context: {
    command: "/load-context",
    commandCount: "1 of 8 commands",
    title: "LOADING PROJECT CONTEXT",
    agents: [
      { name: "Explore Agent", color: CYAN, progress: 100 },
      { name: "Memory Agent", color: PURPLE, progress: 85 },
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
    command: "/brainstorming auth system",
    commandCount: "2 of 8 commands",
    title: "PARALLEL BRAINSTORMING",
    agents: [
      { name: "Workflow Architect", color: PURPLE, progress: 100 },
      { name: "Backend Architect", color: CYAN, progress: 90 },
      { name: "Security Auditor", color: RED, progress: 75 },
      { name: "UX Researcher", color: PINK, progress: 60 },
    ],
    tasks: [
      { text: "Generating 10+ ideas", done: true },
      { text: "Feasibility check", done: true },
      { text: "Trade-off analysis", done: false },
    ],
  },
  build: {
    command: "/implement user-auth",
    commandCount: "3 of 8 commands",
    title: "SPAWNING BUILD AGENTS",
    agents: [
      { name: "Backend Dev", color: CYAN, progress: 100 },
      { name: "Frontend Dev", color: GREEN, progress: 85 },
      { name: "Test Generator", color: YELLOW, progress: 70 },
      { name: "DB Engineer", color: PURPLE, progress: 55 },
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
      { name: "Security Auditor", color: RED, progress: 100 },
      { name: "Dependency Scanner", color: YELLOW, progress: 100 },
    ],
    tasks: [
      { text: "OWASP Top 10 check", done: true },
      { text: "Secrets scan", done: true },
      { text: "CVE database", done: true },
      { text: "Input validation", done: true },
    ],
    score: { value: 9.2, label: "SECURITY SCORE" },
  },
  quality: {
    command: "/verify user-auth",
    commandCount: "6 of 8 commands",
    title: "QUALITY VERIFICATION",
    agents: [
      { name: "Code Quality", color: GREEN, progress: 100 },
      { name: "Test Runner", color: YELLOW, progress: 100 },
      { name: "Type Checker", color: CYAN, progress: 100 },
    ],
    metrics: [
      { label: "COVERAGE", value: "94%", color: GREEN },
      { label: "PASSING", value: "34/34", color: GREEN },
    ],
    score: { value: 9.4, label: "QUALITY SCORE" },
  },
  review: {
    command: "/review-pr 187",
    commandCount: "7 of 8 commands",
    title: "PR REVIEW",
    agents: [
      { name: "Code Reviewer", color: PURPLE, progress: 100 },
      { name: "Security Check", color: RED, progress: 100 },
      { name: "Test Validator", color: YELLOW, progress: 100 },
    ],
    tasks: [
      { text: "Architecture review", done: true },
      { text: "Security patterns", done: true },
      { text: "Test coverage", done: true },
      { text: "Documentation", done: true },
    ],
    score: { value: 8.9, label: "REVIEW SCORE" },
  },
  learn: {
    command: "/remember decision",
    commandCount: "8 of 8 commands",
    title: "STORING KNOWLEDGE",
    agents: [
      { name: "Memory Agent", color: PURPLE, progress: 100 },
      { name: "Graph Builder", color: CYAN, progress: 85 },
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
