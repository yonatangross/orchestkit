/**
 * SkillPhaseDemo - Generic Template for All User-Invokable Skills
 *
 * Shows 3 terminals side-by-side, all progressing through the SAME PHASE
 * at the SAME TIME, but showing DIFFERENT COMPLEXITY outputs.
 *
 * Flow:
 * 1. HOOK SCENE - Attention grabber
 * 2. PHASE PROGRESSION - All 3 levels go through each phase together
 * 3. SUMMARY SCENE - What each level built
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
  code: z.string().optional(), // Code to show during Write phase
});

const phaseSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  simple: phaseContentSchema,
  medium: phaseContentSchema,
  advanced: phaseContentSchema,
});

const levelSummarySchema = z.object({
  title: z.string(),
  features: z.array(z.string()),
  stats: z.object({
    files: z.number(),
    tests: z.number(),
    coverage: z.string().optional(),
  }),
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

// ============================================================================
// TERMINAL PANEL
// ============================================================================

interface TerminalPanelProps {
  level: DifficultyLevel;
  description: string;
  phases: z.infer<typeof phaseSchema>[];
  currentPhaseIndex: number;
  phaseProgress: number; // 0-1 progress within current phase
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
  const panelOpacity = interpolate(frame - startFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const panelScale = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 20, stiffness: 150 },
  });

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
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: color,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{emoji}</span>
          <span
            style={{
              fontSize: 14,
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
            fontSize: 11,
            color: "#ffffffcc",
            fontFamily: "Menlo, Monaco, monospace",
          }}
        >
          {description}
        </span>
      </div>

      {/* Terminal Content */}
      <div
        style={{
          flex: 1,
          padding: 16,
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 11,
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflow: "hidden",
        }}
      >
        {/* Command prompt */}
        <div style={{ color: "#6b7280", marginBottom: 4 }}>
          <span style={{ color: "#22c55e" }}>❯</span> claude
        </div>

        {/* Completed phases (condensed) */}
        {completedPhases.map((phaseIdx) => {
          const phase = phases[phaseIdx];
          return (
            <div key={phaseIdx} style={{ color: "#6b7280" }}>
              <span style={{ color: "#22c55e" }}>✓</span> {phase.shortName}
            </div>
          );
        })}

        {/* Current phase (expanded) */}
        {currentPhaseIndex >= 0 && currentPhaseIndex < phases.length && (
          <CurrentPhaseContent
            phase={phases[currentPhaseIndex]}
            level={level}
            progress={phaseProgress}
            color={color}
            startFrame={startFrame}
          />
        )}
      </div>

      {/* Progress Bar */}
      <div
        style={{
          backgroundColor: "#1a1a24",
          padding: "8px 12px",
          borderTop: `1px solid ${color}30`,
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        {phases.map((phase, i) => {
          const isComplete = completedPhases.includes(i);
          const isCurrent = i === currentPhaseIndex;
          const bgColor = isComplete
            ? "#22c55e"
            : isCurrent
              ? color
              : "#2d2d3a";

          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: bgColor,
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
                    backgroundColor: "#22c55e",
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
// CURRENT PHASE CONTENT
// ============================================================================

interface CurrentPhaseContentProps {
  phase: z.infer<typeof phaseSchema>;
  level: DifficultyLevel;
  progress: number;
  color: string;
  startFrame: number;
}

const CurrentPhaseContent: React.FC<CurrentPhaseContentProps> = ({
  phase,
  level,
  progress,
  color,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const content = phase[level];
  const visibleLines = Math.floor(progress * content.lines.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Phase header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color, fontWeight: 600 }}>▶</span>
        <span style={{ color, fontWeight: 600, textTransform: "uppercase" }}>
          {phase.name}...
        </span>
      </div>

      {/* Content lines */}
      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: 6,
          padding: 10,
          borderLeft: `3px solid ${color}`,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {content.lines.slice(0, visibleLines + 1).map((line, i) => {
          const lineProgress = Math.min(1, (progress * content.lines.length) - i);
          const lineOpacity = interpolate(lineProgress, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                opacity: lineOpacity,
                color: line.startsWith("✓") ? "#22c55e" :
                       line.startsWith("•") ? "#e2e8f0" :
                       line.startsWith("├") || line.startsWith("└") ? color :
                       "#94a3b8",
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* Code block (if provided and in write phase) */}
      {content.code && phase.name.toLowerCase().includes("write") && progress > 0.3 && (
        <CodeBlock code={content.code} color={color} progress={(progress - 0.3) / 0.7} />
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
        marginTop: 8,
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
// SUMMARY CARD
// ============================================================================

interface SummaryCardProps {
  level: DifficultyLevel;
  data: z.infer<typeof levelSummarySchema>;
  startFrame: number;
  index: number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  level,
  data,
  startFrame,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = startFrame + index * 10;
  const adjustedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
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
        backgroundColor: `${color}10`,
        border: `2px solid ${color}`,
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 28 }}>{emoji}</span>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color,
              textTransform: "uppercase",
            }}
          >
            {level}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#f8fafc" }}>
            {data.title}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.features.map((feature, i) => {
          const featureOpacity = interpolate(
            frame,
            [delay + 15 + i * 5, delay + 25 + i * 5],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: featureOpacity,
              }}
            >
              <span style={{ color, fontSize: 14 }}>✓</span>
              <span style={{ fontSize: 14, color: "#e2e8f0" }}>{feature}</span>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          gap: 16,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color }}>
            {data.stats.files}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>files</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color }}>
            {data.stats.tests}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>tests</div>
        </div>
        {data.stats.coverage && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>
              {data.stats.coverage}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>coverage</div>
          </div>
        )}
      </div>
    </div>
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
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Timeline
  const hookDuration = fps * 2.5; // 2.5 seconds for hook
  const phaseTime = fps * 2.5; // 2.5 seconds per phase
  const phaseDuration = phases.length * phaseTime;
  const summaryStart = hookDuration + phaseDuration;
  const summaryDuration = durationInFrames - summaryStart;

  // Calculate current phase and progress
  const phaseSceneFrame = Math.max(0, frame - hookDuration);
  const currentPhaseIndex = Math.min(
    Math.floor(phaseSceneFrame / phaseTime),
    phases.length - 1
  );
  const phaseProgress = Math.min(1, (phaseSceneFrame % phaseTime) / phaseTime);

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
        <AbsoluteFill style={{ padding: 20 }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span
                style={{
                  fontFamily: "Menlo, Monaco, monospace",
                  fontSize: 18,
                  color: primaryColor,
                }}
              >
                {skillCommand}
              </span>
              <span style={{ fontSize: 14, color: "#6b7280" }}>
                Phase {currentPhaseIndex + 1}/{phases.length}: {phases[currentPhaseIndex]?.name}
              </span>
            </div>
          </div>

          {/* 3 Terminals */}
          <div style={{ display: "flex", gap: 16, flex: 1 }}>
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
        <AbsoluteFill style={{ padding: 40 }}>
          {/* Title */}
          <div
            style={{
              textAlign: "center",
              marginBottom: 40,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: "#f8fafc",
                opacity: interpolate(frame, [summaryStart, summaryStart + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                transform: `scale(${spring({ frame: Math.max(0, frame - summaryStart), fps, config: { damping: 12, stiffness: 100 } })})`,
              }}
            >
              ✅ {skillName} Complete
            </div>
            <div
              style={{
                fontSize: 20,
                color: "#94a3b8",
                marginTop: 12,
                opacity: interpolate(frame, [summaryStart + 15, summaryStart + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              {tagline}
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: "flex", gap: 24, marginBottom: 40 }}>
            {levels.map((level, i) => (
              <SummaryCard
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
              gap: 12,
              marginBottom: 40,
              opacity: interpolate(frame, [summaryStart + 60, summaryStart + 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            {phases.map((phase, i) => (
              <React.Fragment key={phase.name}>
                <div
                  style={{
                    backgroundColor: `${primaryColor}20`,
                    border: `1px solid ${primaryColor}40`,
                    borderRadius: 8,
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "#22c55e", fontSize: 16 }}>✓</span>
                  <span style={{ color: "#f8fafc", fontSize: 14, fontWeight: 500 }}>
                    {phase.shortName}
                  </span>
                </div>
                {i < phases.length - 1 && (
                  <span style={{ color: "#4b5563", alignSelf: "center", fontSize: 16 }}>→</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* CTA */}
          <div
            style={{
              textAlign: "center",
              opacity: interpolate(frame, [summaryStart + 80, summaryStart + 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            <div
              style={{
                display: "inline-block",
                backgroundColor: `${primaryColor}15`,
                border: `2px solid ${primaryColor}`,
                borderRadius: 12,
                padding: "16px 32px",
                boxShadow: `0 0 40px ${primaryColor}30`,
              }}
            >
              <span style={{ fontSize: 14, color: "#9ca3af", marginRight: 10 }}>
                Try it:
              </span>
              <span
                style={{
                  fontFamily: "Menlo, Monaco, monospace",
                  fontSize: 20,
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
    </AbsoluteFill>
  );
};

export default SkillPhaseDemo;
