/**
 * SkillPhaseDemo - Generic Template for All User-Invokable Skills
 *
 * Shows 3 terminals side-by-side, all progressing through the SAME PHASE
 * at the SAME TIME, but showing DIFFERENT COMPLEXITY outputs.
 *
 * Flow:
 * 1. HOOK SCENE - Attention grabber
 * 2. PHASE PROGRESSION - All 3 levels go through each phase together
 * 3. SUMMARY SCENE - Architecture graph comparison of what each level built
 */

import React from "react";
import { z } from "zod";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// ============================================================================
// SCHEMA
// ============================================================================

const phaseContentSchema = z.object({
  lines: z.array(z.string()),
  code: z.string().optional(),
});

const phaseSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  simple: phaseContentSchema,
  medium: phaseContentSchema,
  advanced: phaseContentSchema,
});

// Architecture graph node schema
const graphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number(), // Position 0-100
  y: z.number(),
  type: z.enum(["input", "process", "store", "output"]).default("process"),
});

// Architecture graph edge schema
const graphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

// Architecture graph for each level
const architectureSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

const levelSummarySchema = z.object({
  title: z.string(),
  features: z.array(z.string()),
  files: z.array(z.string()), // File paths for tree display
  stats: z.object({
    files: z.number(),
    tests: z.number(),
    coverage: z.string().optional(),
  }),
  architecture: architectureSchema.optional(), // Dependency graph
});

export const skillPhaseDemoSchema = z.object({
  skillName: z.string(),
  skillCommand: z.string(),
  hook: z.string(),
  tagline: z.string().default("Same skill. Any complexity."),
  primaryColor: z.string().default("#8b5cf6"),

  levelDescriptions: z.object({
    simple: z.string(),
    medium: z.string(),
    advanced: z.string(),
  }),

  phases: z.array(phaseSchema),

  summary: z.object({
    simple: levelSummarySchema,
    medium: levelSummarySchema,
    advanced: levelSummarySchema,
  }),

  // Visualization type for summary scene: "graph" (network) or "pipeline" (linear flow)
  summaryVisualization: z.enum(["graph", "pipeline"]).optional(),
});

export type SkillPhaseDemoProps = z.infer<typeof skillPhaseDemoSchema>;
type DifficultyLevel = "simple" | "medium" | "advanced";

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_COLORS: Record<DifficultyLevel, string> = {
  simple: "#22c55e",
  medium: "#f59e0b",
  advanced: "#8b5cf6",
};

const LEVEL_EMOJIS: Record<DifficultyLevel, string> = {
  simple: "🟢",
  medium: "🟡",
  advanced: "🟣",
};

// Node type icons/styles
const NODE_TYPE_STYLES: Record<string, { icon: string; bgColor: string }> = {
  input: { icon: "→", bgColor: "#3b82f6" },
  process: { icon: "⚙", bgColor: "#8b5cf6" },
  store: { icon: "◆", bgColor: "#f59e0b" },
  output: { icon: "✓", bgColor: "#22c55e" },
};

// All 23 user-invocable OrchestKit commands (updated Jan 2026)
const ORK_COMMANDS = [
  { cmd: "/explore", desc: "Deep codebase analysis", icon: "🔍", color: "#8b5cf6" },
  { cmd: "/implement", desc: "Build with parallel agents", icon: "🚀", color: "#22c55e" },
  { cmd: "/verify", desc: "6-agent validation", icon: "✅", color: "#22c55e" },
  { cmd: "/review-pr", desc: "Expert code review", icon: "👁️", color: "#f97316" },
  { cmd: "/commit", desc: "Conventional commits", icon: "📝", color: "#06b6d4" },
  { cmd: "/create-pr", desc: "Auto-generate PRs", icon: "🔀", color: "#f59e0b" },
  { cmd: "/fix-issue", desc: "Debug intelligently", icon: "🔧", color: "#ef4444" },
  { cmd: "/brainstorming", desc: "Think before coding", icon: "💡", color: "#f59e0b" },
  { cmd: "/remember", desc: "Store decisions", icon: "🧠", color: "#ec4899" },
  { cmd: "/recall", desc: "Retrieve patterns", icon: "📚", color: "#ec4899" },
  { cmd: "/load-context", desc: "Auto-load memories", icon: "⚡", color: "#ffc107" },
  { cmd: "/assess", desc: "Rate quality 0-10", icon: "📊", color: "#4caf50" },
  { cmd: "/assess-complexity", desc: "Task analysis", icon: "🎯", color: "#a855f7" },
  { cmd: "/configure", desc: "Setup wizard", icon: "⚙️", color: "#6b7280" },
  { cmd: "/doctor", desc: "Health diagnostics", icon: "🩺", color: "#22c55e" },
  { cmd: "/feedback", desc: "Learning system", icon: "📣", color: "#06b6d4" },
  { cmd: "/demo-producer", desc: "Create demo videos", icon: "🎬", color: "#e91e63" },
  { cmd: "/skill-evolution", desc: "Evolve skills", icon: "🧬", color: "#9c27b0" },
  { cmd: "/decision-history", desc: "Visualize decisions", icon: "📈", color: "#00bcd4" },
  { cmd: "/add-golden", desc: "Dataset curation", icon: "⭐", color: "#ffc107" },
  { cmd: "/mem0-sync", desc: "Cloud memory sync", icon: "☁️", color: "#06b6d4" },
  { cmd: "/git-recovery", desc: "Git rescue commands", icon: "🆘", color: "#ef4444" },
  { cmd: "/worktree", desc: "Multi-instance coord", icon: "🌳", color: "#4caf50" },
];

// ============================================================================
// PHASE HEADER - Prominent phase indicator with smooth transitions
// ============================================================================

interface PhaseHeaderProps {
  phases: z.infer<typeof phaseSchema>[];
  currentPhaseIndex: number;
  phaseProgress: number;
  primaryColor: string;
}

const PhaseHeader: React.FC<PhaseHeaderProps> = ({
  phases,
  currentPhaseIndex,
  phaseProgress,
  primaryColor,
}) => {
  const { fps } = useVideoConfig();
  const currentPhase = phases[currentPhaseIndex];

  // Smooth entrance animation for phase name when it changes
  const nameOpacity = interpolate(phaseProgress, [0, 0.1], [0.7, 1], {
    extrapolateRight: "clamp",
  });
  const nameScale = spring({
    frame: Math.floor(phaseProgress * 30), // Reset spring on phase change
    fps,
    config: { damping: 20, stiffness: 200 },
    from: 0.95,
    to: 1,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        marginBottom: 20,
      }}
    >
      {/* Phase Name with smooth transition */}
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: "#f8fafc",
          textTransform: "uppercase",
          letterSpacing: "2px",
          opacity: nameOpacity,
          transform: `scale(${nameScale})`,
        }}
      >
        ▶ {currentPhase?.name}
      </div>

      {/* Step Indicators with CSS transitions */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {phases.map((phase, i) => {
          const isComplete = i < currentPhaseIndex;
          const isCurrent = i === currentPhaseIndex;

          return (
            <React.Fragment key={phase.name}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: isComplete
                      ? "#22c55e"
                      : isCurrent
                        ? primaryColor
                        : "#3f3f46",
                    border: isCurrent ? `2px solid ${primaryColor}` : "2px solid transparent",
                    boxShadow: isComplete
                      ? "0 0 8px rgba(34, 197, 94, 0.5)"
                      : isCurrent
                        ? `0 0 8px ${primaryColor}50`
                        : "none",
                    transition: "all 0.3s ease-out",
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: isComplete
                      ? "#22c55e"
                      : isCurrent
                        ? "#f8fafc"
                        : "#6b7280",
                    fontWeight: isCurrent ? 600 : 400,
                    transition: "all 0.3s ease-out",
                  }}
                >
                  {phase.shortName}
                </span>
              </div>
              {i < phases.length - 1 && (
                <div
                  style={{
                    width: 24,
                    height: 2,
                    backgroundColor: i < currentPhaseIndex ? "#22c55e" : "#3f3f46",
                    transition: "background-color 0.3s ease-out",
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

    </div>
  );
};

// ============================================================================
// TERMINAL PANEL - Accumulating content with scroll animation
// ============================================================================

interface TerminalPanelProps {
  level: DifficultyLevel;
  description: string;
  phases: z.infer<typeof phaseSchema>[];
  currentPhaseIndex: number;
  phaseProgress: number;
  completedPhases: number[];
  startFrame: number;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({
  level,
  description,
  phases,
  currentPhaseIndex,
  phaseProgress,
  completedPhases,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const color = LEVEL_COLORS[level];
  const emoji = LEVEL_EMOJIS[level];

  // Entry animation
  const panelOpacity = interpolate(frame - startFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const panelScale = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  // Calculate total content height for scroll animation
  const baseLineHeight = 20;
  const completedLinesCount = completedPhases.length;
  const currentPhaseContent = phases[currentPhaseIndex]?.[level];
  const visibleCurrentLines = currentPhaseContent
    ? Math.floor(phaseProgress * currentPhaseContent.lines.length) + 1
    : 0;

  // Scroll offset increases as content accumulates
  const totalContentLines = completedLinesCount + visibleCurrentLines + 3;
  const maxVisibleLines = 18;
  const scrollNeeded = Math.max(0, totalContentLines - maxVisibleLines);
  const scrollOffset = scrollNeeded * baseLineHeight;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0d0d12",
        borderRadius: 12,
        border: `2px solid ${color}40`,
        overflow: "hidden",
        opacity: panelOpacity,
        transform: `scale(${panelScale})`,
        minHeight: 450,
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: color,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{emoji}</span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {level}
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "#ffffffcc",
            fontFamily: "Menlo, Monaco, monospace",
          }}
        >
          {description}
        </span>
      </div>

      {/* Terminal Content - Scrolling container */}
      <div
        style={{
          flex: 1,
          padding: 16,
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 12,
          color: "#e2e8f0",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Scrolling content wrapper */}
        <div
          style={{
            transform: `translateY(-${scrollOffset}px)`,
            transition: "transform 0.3s ease-out",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {/* Command prompt */}
          <div style={{ color: "#6b7280", marginBottom: 4 }}>
            <span style={{ color: "#22c55e" }}>❯</span> claude
          </div>

          {/* ALL phases - completed ones condensed, current expanded */}
          {phases.map((phase, phaseIdx) => {
            const isCompleted = phaseIdx < currentPhaseIndex;
            const isCurrent = phaseIdx === currentPhaseIndex;
            const isFuture = phaseIdx > currentPhaseIndex;

            if (isFuture) return null;

            if (isCompleted) {
              return (
                <CompletedPhaseSection
                  key={phaseIdx}
                  phase={phase}
                  level={level}
                  color={color}
                />
              );
            }

            if (isCurrent) {
              return (
                <CurrentPhaseContent
                  key={phaseIdx}
                  phase={phase}
                  level={level}
                  progress={phaseProgress}
                  color={color}
                />
              );
            }

            return null;
          })}
        </div>

        {/* Fade gradient at top when scrolling */}
        {scrollOffset > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 40,
              background: "linear-gradient(to bottom, #0d0d12 0%, transparent 100%)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Mini Progress Bar */}
      <div
        style={{
          backgroundColor: "#1a1a24",
          padding: "10px 12px",
          borderTop: `1px solid ${color}30`,
          display: "flex",
          gap: 4,
          alignItems: "center",
        }}
      >
        {phases.map((_, i) => {
          const isComplete = i < currentPhaseIndex;
          const isCurrent = i === currentPhaseIndex;

          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: isComplete ? "#22c55e" : "#2d2d3a",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {isCurrent && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${phaseProgress * 100}%`,
                    backgroundColor: color,
                    borderRadius: 2,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// COMPLETED PHASE SECTION - Shows condensed completed phase with smooth entrance
// ============================================================================

interface CompletedPhaseSectionProps {
  phase: z.infer<typeof phaseSchema>;
  level: DifficultyLevel;
  color: string;
  isNewlyCompleted?: boolean;
}

const CompletedPhaseSection: React.FC<CompletedPhaseSectionProps> = ({
  phase,
  level,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const content = phase[level];

  // Smooth collapse animation using spring
  const collapseScale = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 200 },
    from: 1.02,
    to: 1,
  });

  return (
    <div
      style={{
        marginBottom: 8,
        transform: `scale(${collapseScale})`,
        transformOrigin: "top left",
      }}
    >
      {/* Phase header - completed */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ color: "#22c55e", fontSize: 11 }}>✓</span>
        <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 600 }}>
          {phase.shortName}
        </span>
      </div>

      {/* Condensed content preview */}
      <div
        style={{
          backgroundColor: "rgba(34, 197, 94, 0.05)",
          borderLeft: "2px solid #22c55e40",
          borderRadius: 4,
          padding: "6px 10px",
          marginLeft: 8,
        }}
      >
        {content.lines.slice(0, 2).map((line, i) => (
          <div
            key={i}
            style={{
              color: "#6b7280",
              fontSize: 10,
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {line.startsWith("✓") ? line : `✓ ${line}`}
          </div>
        ))}
        {content.lines.length > 2 && (
          <div style={{ color: "#4b5563", fontSize: 9 }}>
            +{content.lines.length - 2} more
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// CURRENT PHASE CONTENT - Expanded view with animated lines + smooth entrance
// ============================================================================

interface CurrentPhaseContentProps {
  phase: z.infer<typeof phaseSchema>;
  level: DifficultyLevel;
  progress: number;
  color: string;
}

const CurrentPhaseContent: React.FC<CurrentPhaseContentProps> = ({
  phase,
  level,
  progress,
  color,
}) => {
  const content = phase[level];

  // Entrance animation - smooth fade and slide in during first 15% of phase
  const entranceProgress = Math.min(1, progress / 0.15);
  const entranceOpacity = interpolate(entranceProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const entranceTranslateY = interpolate(entranceProgress, [0, 1], [12, 0], {
    extrapolateRight: "clamp",
  });

  // Adjust content progress to account for entrance animation
  const contentProgress = Math.max(0, (progress - 0.1) / 0.9);
  const visibleLines = Math.floor(contentProgress * content.lines.length);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        opacity: entranceOpacity,
        transform: `translateY(${entranceTranslateY}px)`,
        transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
      }}
    >
      {/* Phase header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color, fontWeight: 600, fontSize: 11 }}>▶</span>
        <span
          style={{
            color,
            fontWeight: 600,
            textTransform: "uppercase",
            fontSize: 11,
          }}
        >
          {phase.name}...
        </span>
      </div>

      {/* Content box */}
      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.02)",
          borderRadius: 6,
          padding: 10,
          borderLeft: `3px solid ${color}`,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {content.lines.slice(0, visibleLines + 1).map((line, i) => {
          const lineProgress = Math.min(1, contentProgress * content.lines.length - i);
          const lineOpacity = interpolate(lineProgress, [0, 0.3], [0, 1], {
            extrapolateRight: "clamp",
          });

          // Determine line styling
          const isFileTreeLine = line.startsWith("├") || line.startsWith("└");
          const isBullet = line.startsWith("•");
          const isCheckmark = line.startsWith("✓");

          let lineColor = "#94a3b8";
          if (isCheckmark) lineColor = "#22c55e";
          else if (isFileTreeLine) lineColor = color;
          else if (isBullet) lineColor = "#e2e8f0";

          return (
            <div
              key={i}
              style={{
                opacity: lineOpacity,
                color: lineColor,
                fontSize: 11,
                lineHeight: 1.6,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* Code block (if provided and in write phase) */}
      {content.code && phase.name.toLowerCase().includes("write") && contentProgress > 0.4 && (
        <CodeBlock code={content.code} color={color} progress={(contentProgress - 0.4) / 0.6} />
      )}
    </div>
  );
};

// ============================================================================
// CODE BLOCK
// ============================================================================

interface CodeBlockProps {
  code: string;
  color: string;
  progress: number;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, color, progress }) => {
  const lines = code.split("\n");
  const visibleLines = Math.floor(progress * lines.length);

  return (
    <div
      style={{
        backgroundColor: "#1a1a24",
        borderRadius: 6,
        padding: 10,
        border: `1px solid ${color}30`,
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 10, marginBottom: 6 }}>
        // code preview
      </div>
      {lines.slice(0, visibleLines + 1).map((line, i) => (
        <div
          key={i}
          style={{
            color: "#e2e8f0",
            fontSize: 10,
            lineHeight: 1.4,
            whiteSpace: "pre",
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// SUMMARY CARD WRAPPER - Shared header/footer for all visualizations
// ============================================================================

interface SummaryCardProps {
  level: DifficultyLevel;
  data: z.infer<typeof levelSummarySchema>;
  startFrame: number;
  index: number;
  children: React.ReactNode;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  level,
  data,
  startFrame,
  index,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = startFrame + index * 8;
  const adjustedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  const opacity = interpolate(adjustedFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const color = LEVEL_COLORS[level];
  const emoji = LEVEL_EMOJIS[level];

  return (
    <div
      style={{
        flex: 1,
        opacity,
        transform: `scale(${scale})`,
        backgroundColor: "#0d0d14",
        border: `2px solid ${color}50`,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: `0 4px 24px ${color}15, inset 0 1px 0 ${color}20`,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 24 }}>{emoji}</span>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#ffffffcc",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
            }}
          >
            {level}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>
            {data.title}
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 20,
          background: `radial-gradient(ellipse at 50% 0%, ${color}08 0%, transparent 70%)`,
        }}
      >
        {children}
      </div>

      {/* Stats Footer */}
      <div
        style={{
          backgroundColor: `${color}10`,
          padding: "14px 18px",
          borderTop: `1px solid ${color}25`,
          display: "flex",
          justifyContent: "space-around",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color }}>
            {data.stats.files}
          </div>
          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>files</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color }}>
            {data.stats.tests}
          </div>
          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>tests</div>
        </div>
        {data.stats.coverage && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>
              {data.stats.coverage}
            </div>
            <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>coverage</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// HORIZONTAL FLOW - Clean 3-step flow for SIMPLE level
// ============================================================================

interface HorizontalFlowProps {
  level: DifficultyLevel;
  data: z.infer<typeof levelSummarySchema>;
  startFrame: number;
  index: number;
}

const HorizontalFlow: React.FC<HorizontalFlowProps> = ({
  level,
  data,
  startFrame,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = startFrame + index * 8;
  const color = LEVEL_COLORS[level];

  // 3-step flow: Request → Process → Done
  const steps = [
    { id: "input", label: "Request", icon: "→", bg: "#3b82f6" },
    { id: "process", label: data.features[0] || "Process", icon: "⚙", bg: color },
    { id: "output", label: "Done", icon: "✓", bg: "#22c55e" },
  ];

  return (
    <SummaryCard level={level} data={data} startFrame={startFrame} index={index}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          padding: "20px 0",
        }}
      >
        {steps.map((step, i) => {
          const stepDelay = delay + 20 + i * 15;
          const stepOpacity = interpolate(frame, [stepDelay, stepDelay + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const stepScale = spring({
            frame: Math.max(0, frame - stepDelay),
            fps,
            config: { damping: 12, stiffness: 150 },
          });

          const arrowDelay = stepDelay + 8;
          const arrowOpacity = interpolate(frame, [arrowDelay, arrowDelay + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <React.Fragment key={step.id}>
              {/* Step box */}
              <div
                style={{
                  opacity: stepOpacity,
                  transform: `scale(${stepScale})`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: step.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 4px 20px ${step.bg}50, 0 0 0 3px ${step.bg}20`,
                  }}
                >
                  <span style={{ fontSize: 24, color: "#fff" }}>{step.icon}</span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#e2e8f0",
                    fontWeight: 500,
                    textAlign: "center",
                    maxWidth: 80,
                  }}
                >
                  {step.label}
                </div>
              </div>

              {/* Arrow */}
              {i < steps.length - 1 && (
                <div
                  style={{
                    opacity: arrowOpacity,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 16px",
                    marginBottom: 30,
                  }}
                >
                  <svg width="40" height="20" viewBox="0 0 40 20">
                    <defs>
                      <linearGradient id={`arrow-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={steps[i].bg} stopOpacity="0.8" />
                        <stop offset="100%" stopColor={steps[i + 1].bg} stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                    <line
                      x1="0"
                      y1="10"
                      x2="30"
                      y2="10"
                      stroke={`url(#arrow-grad-${i})`}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <polygon
                      points="28,5 38,10 28,15"
                      fill={steps[i + 1].bg}
                      opacity="0.9"
                    />
                  </svg>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Features list */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginTop: 16,
        }}
      >
        {data.features.map((feature, i) => {
          const featureDelay = delay + 60 + i * 5;
          const featureOpacity = interpolate(frame, [featureDelay, featureDelay + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={feature}
              style={{
                opacity: featureOpacity,
                backgroundColor: `${color}15`,
                border: `1px solid ${color}30`,
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 11,
                color: "#94a3b8",
              }}
            >
              <span style={{ color: "#22c55e", marginRight: 6 }}>✓</span>
              {feature}
            </div>
          );
        })}
      </div>
    </SummaryCard>
  );
};

// ============================================================================
// FEATURE CARDS - 2x2 grid with icons for MEDIUM level
// ============================================================================

interface FeatureCardsProps {
  level: DifficultyLevel;
  data: z.infer<typeof levelSummarySchema>;
  startFrame: number;
  index: number;
}

const FEATURE_ICONS: Record<string, string> = {
  "google": "🔐",
  "github": "🐙",
  "oauth": "🔑",
  "refresh": "🔄",
  "token": "🎫",
  "session": "📦",
  "default": "⚙",
};

function getFeatureIcon(feature: string): string {
  const lower = feature.toLowerCase();
  for (const [key, icon] of Object.entries(FEATURE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return FEATURE_ICONS.default;
}

const FeatureCards: React.FC<FeatureCardsProps> = ({
  level,
  data,
  startFrame,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = startFrame + index * 8;
  const color = LEVEL_COLORS[level];

  return (
    <SummaryCard level={level} data={data} startFrame={startFrame} index={index}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          padding: "8px 0",
        }}
      >
        {data.features.slice(0, 4).map((feature, i) => {
          const cardDelay = delay + 20 + i * 10;
          const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const cardScale = spring({
            frame: Math.max(0, frame - cardDelay),
            fps,
            config: { damping: 12, stiffness: 150 },
          });

          const icon = getFeatureIcon(feature);

          return (
            <div
              key={feature}
              style={{
                opacity: cardOpacity,
                transform: `scale(${cardScale})`,
                backgroundColor: "#13131a",
                border: `1px solid ${color}30`,
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                boxShadow: `0 2px 12px ${color}10`,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: `${color}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                {icon}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#e2e8f0",
                  fontWeight: 500,
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
              >
                {feature}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#22c55e",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>✓</span> Ready
              </div>
            </div>
          );
        })}
      </div>
    </SummaryCard>
  );
};

// ============================================================================
// POLISHED GRAPH - Refined network visualization for ADVANCED level
// ============================================================================

interface PolishedGraphProps {
  level: DifficultyLevel;
  data: z.infer<typeof levelSummarySchema>;
  startFrame: number;
  index: number;
}

const PolishedGraph: React.FC<PolishedGraphProps> = ({
  level,
  data,
  startFrame,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = startFrame + index * 8;
  const color = LEVEL_COLORS[level];

  // Better positioned architecture for advanced
  const architecture = generateAdvancedArchitecture();

  return (
    <SummaryCard level={level} data={data} startFrame={startFrame} index={index}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 240,
        }}
      >
        {/* Background grid for professional look */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
          viewBox="0 0 400 240"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Grid pattern */}
            <pattern id={`grid-${index}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke={color} strokeOpacity="0.05" strokeWidth="0.5" />
            </pattern>
            {/* Edge gradient */}
            <linearGradient id={`edge-grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="50%" stopColor={color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={color} stopOpacity="0.4" />
            </linearGradient>
            {/* Glow filter */}
            <filter id={`glow-${index}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Arrow marker */}
            <marker
              id={`arrow-${index}`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill={color} fillOpacity="0.8" />
            </marker>
          </defs>

          {/* Background grid */}
          <rect width="100%" height="100%" fill={`url(#grid-${index})`} />

          {/* Layer labels */}
          {["Entry", "Auth", "Verify", "Store", "Exit"].map((label, i) => {
            const x = 40 + i * 80;
            const labelDelay = delay + 10 + i * 3;
            const labelOpacity = interpolate(frame, [labelDelay, labelDelay + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <text
                key={label}
                x={x}
                y={20}
                fill={color}
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                opacity={labelOpacity * 0.5}
                style={{ textTransform: "uppercase", letterSpacing: "1px" }}
              >
                {label}
              </text>
            );
          })}

          {/* Edges with smooth bezier curves */}
          {architecture.edges.map((edge, i) => {
            const fromNode = architecture.nodes.find((n) => n.id === edge.from);
            const toNode = architecture.nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const edgeDelay = delay + 35 + i * 3;
            const edgeProgress = interpolate(frame, [edgeDelay, edgeDelay + 15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            // Smart bezier control points based on direction
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const isHorizontal = Math.abs(dx) > Math.abs(dy);

            let cx1, cy1, cx2, cy2;
            if (isHorizontal) {
              cx1 = fromNode.x + dx * 0.4;
              cy1 = fromNode.y;
              cx2 = toNode.x - dx * 0.4;
              cy2 = toNode.y;
            } else {
              cx1 = fromNode.x + dx * 0.5;
              cy1 = fromNode.y + dy * 0.2;
              cx2 = toNode.x - dx * 0.5;
              cy2 = toNode.y - dy * 0.2;
            }

            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={`M ${fromNode.x} ${fromNode.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toNode.x} ${toNode.y}`}
                fill="none"
                stroke={`url(#edge-grad-${index})`}
                strokeWidth="2.5"
                strokeOpacity={edgeProgress}
                strokeDasharray="300"
                strokeDashoffset={300 - 300 * edgeProgress}
                markerEnd={`url(#arrow-${index})`}
                filter={`url(#glow-${index})`}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {architecture.nodes.map((node, i) => {
          const nodeDelay = delay + 15 + i * 5;
          const nodeOpacity = interpolate(frame, [nodeDelay, nodeDelay + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const nodeScale = spring({
            frame: Math.max(0, frame - nodeDelay),
            fps,
            config: { damping: 14, stiffness: 180 },
          });

          const nodeStyle = NODE_TYPE_STYLES[node.type] || NODE_TYPE_STYLES.process;
          const isOutput = node.type === "output";

          // Convert viewBox coords (0-400, 0-240) to percentages
          const leftPct = (node.x / 400) * 100;
          const topPct = (node.y / 240) * 100;

          return (
            <div
              key={node.id}
              style={{
                position: "absolute",
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: `translate(-50%, -50%) scale(${nodeScale})`,
                opacity: nodeOpacity,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              {/* Node circle with enhanced glow */}
              <div
                style={{
                  width: isOutput ? 48 : 44,
                  height: isOutput ? 48 : 44,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${nodeStyle.bgColor} 0%, ${nodeStyle.bgColor}dd 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `
                    0 4px 20px ${nodeStyle.bgColor}50,
                    0 0 30px ${nodeStyle.bgColor}40,
                    inset 0 2px 4px rgba(255,255,255,0.25),
                    inset 0 -2px 4px rgba(0,0,0,0.15)
                  `,
                  border: `2px solid rgba(255,255,255,0.2)`,
                }}
              >
                <span style={{ fontSize: isOutput ? 22 : 18, color: "#fff" }}>
                  {isOutput ? "✓" : nodeStyle.icon}
                </span>
              </div>
              {/* Node label - skip for output node */}
              {!isOutput && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#e2e8f0",
                    fontWeight: 600,
                    textAlign: "center",
                    textShadow: "0 2px 4px rgba(0,0,0,0.6)",
                    maxWidth: 70,
                    lineHeight: 1.2,
                    backgroundColor: "rgba(0,0,0,0.3)",
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  {node.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SummaryCard>
  );
};

// ============================================================================
// ADVANCED ARCHITECTURE GENERATOR - Professional layered layout
// ============================================================================

function generateAdvancedArchitecture(): z.infer<typeof architectureSchema> {
  // 5 clear horizontal layers (viewBox: 400x240)
  // More spread out, professional positioning
  return {
    nodes: [
      // Layer 1: Entry (x=40)
      { id: "req", label: "Request", x: 40, y: 120, type: "input" },
      // Layer 2: Auth methods (x=120)
      { id: "oauth", label: "OAuth 2.0", x: 120, y: 70, type: "process" },
      { id: "mfa", label: "MFA Gate", x: 120, y: 170, type: "process" },
      // Layer 3: Verification (x=200)
      { id: "totp", label: "TOTP", x: 200, y: 90, type: "process" },
      { id: "sms", label: "SMS/Email", x: 200, y: 150, type: "process" },
      // Layer 4: Storage (x=280)
      { id: "session", label: "Session", x: 280, y: 80, type: "store" },
      { id: "audit", label: "Audit Log", x: 280, y: 160, type: "store" },
      // Layer 5: Exit (x=360)
      { id: "ok", label: "", x: 360, y: 120, type: "output" },
    ],
    edges: [
      // From request
      { from: "req", to: "oauth" },
      { from: "req", to: "mfa" },
      // OAuth path
      { from: "oauth", to: "session" },
      // MFA path
      { from: "mfa", to: "totp" },
      { from: "mfa", to: "sms" },
      { from: "totp", to: "session" },
      { from: "sms", to: "session" },
      // Storage to output
      { from: "session", to: "audit" },
      { from: "session", to: "ok" },
      { from: "audit", to: "ok" },
    ],
  };
}

// ============================================================================
// ADAPTIVE SUMMARY VISUALIZATION - Auto-selects based on level
// ============================================================================

interface AdaptiveSummaryProps {
  level: DifficultyLevel;
  data: z.infer<typeof levelSummarySchema>;
  startFrame: number;
  index: number;
}

const AdaptiveSummary: React.FC<AdaptiveSummaryProps> = (props) => {
  const { level } = props;

  // Auto-select visualization based on complexity level
  switch (level) {
    case "simple":
      return <HorizontalFlow {...props} />;
    case "medium":
      return <FeatureCards {...props} />;
    case "advanced":
      return <PolishedGraph {...props} />;
    default:
      return <HorizontalFlow {...props} />;
  }
};

// ============================================================================
// PLUGIN OUTRO - Animated marquee showcase for OrchestKit commands
// ============================================================================

// Split commands into 3 rows for marquee
const COMMANDS_ROW1 = ORK_COMMANDS.slice(0, 8);
const COMMANDS_ROW2 = ORK_COMMANDS.slice(8, 16);
const COMMANDS_ROW3 = ORK_COMMANDS.slice(16, 23);

interface CommandBadgeProps {
  cmd: typeof ORK_COMMANDS[0];
  isCurrentCommand: boolean;
  primaryColor: string;
}

const CommandBadge: React.FC<CommandBadgeProps> = ({ cmd, isCurrentCommand, primaryColor }) => {
  const cardColor = isCurrentCommand ? primaryColor : cmd.color;

  return (
    <div
      style={{
        flex: "0 0 auto",
        backgroundColor: isCurrentCommand ? `${primaryColor}25` : "rgba(18, 18, 26, 0.9)",
        border: isCurrentCommand ? `2px solid ${primaryColor}` : `1px solid ${cmd.color}40`,
        borderRadius: 14,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        minWidth: 220,
        boxShadow: isCurrentCommand
          ? `0 4px 24px ${primaryColor}50, 0 0 40px ${primaryColor}30`
          : `0 4px 16px ${cmd.color}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
        transform: isCurrentCommand ? "scale(1.05)" : "scale(1)",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: `${cardColor}25`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
          boxShadow: `0 0 16px ${cardColor}30`,
        }}
      >
        {cmd.icon}
      </div>
      {/* Text */}
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: isCurrentCommand ? primaryColor : cardColor,
            fontFamily: "Menlo, Monaco, monospace",
            marginBottom: 2,
          }}
        >
          {cmd.cmd}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#8b949e",
            lineHeight: 1.2,
          }}
        >
          {cmd.desc}
        </div>
      </div>
    </div>
  );
};

interface MarqueeRowProps {
  commands: typeof ORK_COMMANDS;
  direction: "left" | "right";
  speed: number;
  frame: number;
  currentCommand: string;
  primaryColor: string;
}

const MarqueeRow: React.FC<MarqueeRowProps> = ({
  commands,
  direction,
  speed,
  frame,
  currentCommand,
  primaryColor,
}) => {
  // Triple the commands for seamless loop
  const tripled = [...commands, ...commands, ...commands];

  // Calculate scroll position
  const totalWidth = commands.length * 240; // Approximate width per badge
  let scrollX = (frame * speed) % totalWidth;
  if (direction === "right") scrollX = -scrollX;

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        transform: `translateX(${-scrollX}px)`,
        willChange: "transform",
      }}
    >
      {tripled.map((cmd, idx) => (
        <CommandBadge
          key={`${cmd.cmd}-${idx}`}
          cmd={cmd}
          isCurrentCommand={currentCommand.includes(cmd.cmd.replace("/", ""))}
          primaryColor={primaryColor}
        />
      ))}
    </div>
  );
};

interface PluginOutroProps {
  primaryColor: string;
  currentCommand: string;
}

const PluginOutro: React.FC<PluginOutroProps> = ({ primaryColor, currentCommand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title entrance
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Marquee entrance with zoom
  const marqueeOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const marqueeScale = interpolate(frame, [0, fps * 2], [1.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3D perspective tilt
  const tiltX = interpolate(frame, [0, fps * 1.5], [12, 4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        perspective: 1200,
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 50% 30%, ${primaryColor}12 0%, transparent 50%),
            radial-gradient(ellipse at 30% 70%, #22c55e08 0%, transparent 40%),
            radial-gradient(ellipse at 70% 70%, #06b6d408 0%, transparent 40%)
          `,
        }}
      />

      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 40,
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontSize: 16,
            color: primaryColor,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "4px",
            marginBottom: 10,
          }}
        >
          OrchestKit
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: "#f8fafc",
            textShadow: `0 0 60px ${primaryColor}30`,
          }}
        >
          23 Commands at Your Fingertips
        </div>
        <div
          style={{
            fontSize: 16,
            color: "#6b7280",
            marginTop: 12,
          }}
        >
          185 skills • 35 agents • 167 hooks
        </div>
      </div>

      {/* Animated Marquee Container */}
      <div
        style={{
          width: "130vw",
          opacity: marqueeOpacity,
          transform: `scale(${marqueeScale}) rotateX(${tiltX}deg)`,
          transformStyle: "preserve-3d",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Row 1 - Left */}
        <div style={{ overflow: "hidden" }}>
          <MarqueeRow
            commands={COMMANDS_ROW1}
            direction="left"
            speed={1.8}
            frame={frame}
            currentCommand={currentCommand}
            primaryColor={primaryColor}
          />
        </div>

        {/* Row 2 - Right */}
        <div style={{ overflow: "hidden" }}>
          <MarqueeRow
            commands={COMMANDS_ROW2}
            direction="right"
            speed={1.4}
            frame={frame}
            currentCommand={currentCommand}
            primaryColor={primaryColor}
          />
        </div>

        {/* Row 3 - Left (faster) */}
        <div style={{ overflow: "hidden" }}>
          <MarqueeRow
            commands={COMMANDS_ROW3}
            direction="left"
            speed={2.0}
            frame={frame}
            currentCommand={currentCommand}
            primaryColor={primaryColor}
          />
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          textAlign: "center",
          marginTop: 40,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1], { extrapolateRight: "clamp" }),
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "inline-block",
            backgroundColor: `${primaryColor}15`,
            border: `2px solid ${primaryColor}`,
            borderRadius: 14,
            padding: "16px 32px",
            boxShadow: `0 0 40px ${primaryColor}30`,
          }}
        >
          <span
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 20,
              fontWeight: 600,
              color: primaryColor,
            }}
          >
            /plugin install ork
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SkillPhaseDemo: React.FC<SkillPhaseDemoProps> = ({
  skillName,
  skillCommand,
  hook,
  tagline,
  primaryColor,
  levelDescriptions,
  phases,
  summary,
  // summaryVisualization is kept in schema for backwards compatibility but
  // AdaptiveSummary now auto-selects based on level
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Timeline
  const hookDuration = fps * 2.5; // 2.5 seconds for hook
  const phaseTime = fps * 2.5; // 2.5 seconds per phase
  const phaseDuration = phases.length * phaseTime;
  const summaryStart = hookDuration + phaseDuration;
  const outroDuration = fps * 4; // 4 seconds for outro
  const summaryDuration = Math.max(fps * 4, durationInFrames - summaryStart - outroDuration); // At least 4s for summary
  const outroStart = summaryStart + summaryDuration;

  // Calculate current phase and progress
  const phaseSceneFrame = Math.max(0, frame - hookDuration);
  const currentPhaseIndex = Math.min(
    Math.floor(phaseSceneFrame / phaseTime),
    phases.length - 1
  );
  const phaseLocalFrame = phaseSceneFrame % phaseTime;

  // Progress - smooth from 0 to 1 over the phase duration
  const phaseProgress = Math.min(1, phaseLocalFrame / phaseTime);

  // Which phases are complete
  const completedPhases = Array.from({ length: currentPhaseIndex }, (_, i) => i);

  const levels: DifficultyLevel[] = ["simple", "medium", "advanced"];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 20% 30%, ${LEVEL_COLORS.simple}08 0%, transparent 40%),
            radial-gradient(ellipse at 50% 50%, ${LEVEL_COLORS.medium}06 0%, transparent 40%),
            radial-gradient(ellipse at 80% 70%, ${LEVEL_COLORS.advanced}08 0%, transparent 40%)
          `,
        }}
      />

      {/* ========== HOOK SCENE ========== */}
      <Sequence from={0} durationInFrames={hookDuration}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#f8fafc",
              textAlign: "center",
              opacity: interpolate(frame, [0, 20], [0, 1]),
              transform: `scale(${spring({ frame, fps, config: { damping: 12, stiffness: 100 } })})`,
            }}
          >
            {hook}
          </div>
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 28,
              color: primaryColor,
              opacity: interpolate(frame, [20, 40], [0, 1]),
            }}
          >
            {skillCommand}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#6b7280",
              opacity: interpolate(frame, [40, 60], [0, 1]),
            }}
          >
            {tagline}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ========== PHASE PROGRESSION SCENE ========== */}
      <Sequence from={hookDuration} durationInFrames={phaseDuration}>
        <AbsoluteFill style={{ padding: 24, display: "flex", flexDirection: "column" }}>
          {/* Phase Header */}
          <PhaseHeader
            phases={phases}
            currentPhaseIndex={currentPhaseIndex}
            phaseProgress={phaseProgress}
            primaryColor={primaryColor}
          />

          {/* 3 Terminals */}
          <div
            style={{
              display: "flex",
              gap: 16,
              flex: 1,
            }}
          >
            {levels.map((level, i) => (
              <TerminalPanel
                key={level}
                level={level}
                description={levelDescriptions[level]}
                phases={phases}
                currentPhaseIndex={currentPhaseIndex}
                phaseProgress={phaseProgress}
                completedPhases={completedPhases}
                startFrame={i * 5}
              />
            ))}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ========== SUMMARY SCENE ========== */}
      <Sequence from={summaryStart} durationInFrames={summaryDuration}>
        <AbsoluteFill style={{ padding: 32, display: "flex", flexDirection: "column" }}>
          {/* Title */}
          <div
            style={{
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: "#f8fafc",
                opacity: interpolate(frame, [summaryStart, summaryStart + 20], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                transform: `scale(${spring({
                  frame: Math.max(0, frame - summaryStart),
                  fps,
                  config: { damping: 12, stiffness: 100 },
                })})`,
              }}
            >
              {skillName} Complete
            </div>
            <div
              style={{
                fontSize: 18,
                color: "#94a3b8",
                marginTop: 8,
                opacity: interpolate(frame, [summaryStart + 15, summaryStart + 30], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {tagline}
            </div>
          </div>

          {/* Adaptive Visualization - Auto-selects best visualization per level */}
          <div style={{ display: "flex", gap: 16, flex: 1, marginBottom: 20 }}>
            {levels.map((level, i) => (
              <AdaptiveSummary
                key={level}
                level={level}
                data={summary[level]}
                startFrame={20}
                index={i}
              />
            ))}
          </div>

          {/* Phase Timeline */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginBottom: 20,
              opacity: interpolate(frame, [summaryStart + 60, summaryStart + 80], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {phases.map((phase, i) => (
              <React.Fragment key={phase.name}>
                <div
                  style={{
                    backgroundColor: `${primaryColor}20`,
                    border: `1px solid ${primaryColor}40`,
                    borderRadius: 6,
                    padding: "6px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span style={{ color: "#22c55e", fontSize: 12 }}>✓</span>
                  <span style={{ color: "#f8fafc", fontSize: 12, fontWeight: 500 }}>
                    {phase.shortName}
                  </span>
                </div>
                {i < phases.length - 1 && (
                  <span style={{ color: "#4b5563", alignSelf: "center", fontSize: 12 }}>→</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* CTA */}
          <div
            style={{
              textAlign: "center",
              opacity: interpolate(frame, [summaryStart + 80, summaryStart + 100], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <div
              style={{
                display: "inline-block",
                backgroundColor: `${primaryColor}15`,
                border: `2px solid ${primaryColor}`,
                borderRadius: 12,
                padding: "12px 24px",
                boxShadow: `0 0 40px ${primaryColor}30`,
              }}
            >
              <span style={{ fontSize: 13, color: "#9ca3af", marginRight: 10 }}>
                Try it:
              </span>
              <span
                style={{
                  fontFamily: "Menlo, Monaco, monospace",
                  fontSize: 16,
                  fontWeight: 600,
                  color: primaryColor,
                }}
              >
                {skillCommand}
              </span>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ========== PLUGIN OUTRO SCENE ========== */}
      <Sequence from={outroStart} durationInFrames={outroDuration}>
        <PluginOutro primaryColor={primaryColor} currentCommand={skillCommand} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default SkillPhaseDemo;
