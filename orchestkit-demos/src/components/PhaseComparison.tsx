/**
 * PhaseComparison - Generic Template for All User-Invokable Skills
 *
 * Shows skill phases as ROWS, complexity levels as COLUMNS.
 * Each phase reveals what Simple/Medium/Advanced creates.
 *
 * Usage:
 * 1. Define phases with outputs for each complexity level
 * 2. Define summary with features each level provides
 * 3. The template handles animation, progression, and layout
 *
 * Config Generation:
 * Use AskUserQuestion to gather:
 * - What phases does this skill have?
 * - For each phase, what does Simple/Medium/Advanced output?
 * - What are the key features at each complexity level?
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
// SCHEMA - Generic for all skills
// ============================================================================

const phaseOutputSchema = z.object({
  lines: z.array(z.string()), // Lines of output for this phase at this level
});

const phaseSchema = z.object({
  name: z.string(),
  shortName: z.string().optional(),
  simple: phaseOutputSchema,
  medium: phaseOutputSchema,
  advanced: phaseOutputSchema,
});

const levelSummarySchema = z.object({
  title: z.string(), // e.g., "JWT Auth", "+OAuth", "+MFA"
  features: z.array(z.string()), // Key features/capabilities
  files: z.array(z.string()).optional(), // Files created (optional)
});

export const phaseComparisonSchema = z.object({
  // Skill identity
  skillName: z.string(),
  skillCommand: z.string(),
  hook: z.string(), // Attention-grabbing headline
  tagline: z.string().default("Same skill. Any complexity."),
  primaryColor: z.string().default("#8b5cf6"),

  // Phase definitions
  phases: z.array(phaseSchema),

  // Summary data for each level
  summary: z.object({
    simple: levelSummarySchema,
    medium: levelSummarySchema,
    advanced: levelSummarySchema,
  }),
});

export type PhaseComparisonProps = z.infer<typeof phaseComparisonSchema>;
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
// SUBCOMPONENTS
// ============================================================================

interface PhaseRowProps {
  phase: z.infer<typeof phaseSchema>;
  phaseIndex: number;
  isActive: boolean;
  isComplete: boolean;
  startFrame: number;
  primaryColor: string;
}

const PhaseRow: React.FC<PhaseRowProps> = ({
  phase,
  phaseIndex,
  isActive,
  isComplete,
  startFrame,
  primaryColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - startFrame);

  // Row entry animation
  const rowOpacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const rowScale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  // Status indicator
  const statusIcon = isComplete ? "✓" : isActive ? "▶" : "○";
  const statusColor = isComplete ? "#22c55e" : isActive ? primaryColor : "#4b5563";
  const statusLabel = isComplete ? "Complete" : isActive ? "Active" : "Pending";

  const levels: DifficultyLevel[] = ["simple", "medium", "advanced"];

  return (
    <div
      style={{
        opacity: rowOpacity,
        transform: `scale(${rowScale})`,
        marginBottom: 16,
      }}
    >
      {/* Phase Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          backgroundColor: isActive ? `${primaryColor}15` : "rgba(255,255,255,0.03)",
          borderRadius: "8px 8px 0 0",
          borderBottom: `2px solid ${isActive ? primaryColor : "rgba(255,255,255,0.1)"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 18,
              color: statusColor,
              fontWeight: 700,
            }}
          >
            {statusIcon}
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#f8fafc",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Phase {phaseIndex + 1}: {phase.name}
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            color: statusColor,
            fontWeight: 500,
            backgroundColor: `${statusColor}20`,
            padding: "4px 10px",
            borderRadius: 4,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Level Columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          padding: 12,
          backgroundColor: "rgba(10, 10, 15, 0.8)",
          borderRadius: "0 0 8px 8px",
        }}
      >
        {levels.map((level, levelIndex) => {
          const levelData = phase[level];
          const levelDelay = startFrame + 10 + levelIndex * 8;
          const levelFrame = Math.max(0, frame - levelDelay);

          const columnOpacity = interpolate(levelFrame, [0, 12], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });

          const color = LEVEL_COLORS[level];
          const emoji = LEVEL_EMOJIS[level];

          return (
            <div
              key={level}
              style={{
                opacity: columnOpacity,
                backgroundColor: `${color}08`,
                borderRadius: 8,
                padding: 12,
                borderLeft: `3px solid ${color}`,
                minHeight: 80,
              }}
            >
              {/* Level Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 14 }}>{emoji}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color,
                    textTransform: "uppercase",
                  }}
                >
                  {level}
                </span>
              </div>

              {/* Output Lines */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(isComplete || isActive) ? (
                  levelData.lines.map((line, lineIndex) => {
                    const lineDelay = levelDelay + 5 + lineIndex * 3;
                    const lineFrame = Math.max(0, frame - lineDelay);
                    const lineOpacity = interpolate(lineFrame, [0, 8], [0, 1], {
                      extrapolateRight: "clamp",
                      extrapolateLeft: "clamp",
                    });

                    return (
                      <div
                        key={lineIndex}
                        style={{
                          fontSize: 11,
                          fontFamily: "Menlo, Monaco, monospace",
                          color: "#e2e8f0",
                          opacity: lineOpacity,
                        }}
                      >
                        {line}
                      </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#4b5563",
                      fontStyle: "italic",
                    }}
                  >
                    (waiting...)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Summary Card Component
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
  const adjustedFrame = Math.max(0, frame - startFrame - index * 12);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
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
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>{emoji}</span>
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
          <div style={{ fontSize: 18, fontWeight: 600, color: "#f8fafc" }}>
            {data.title}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.features.map((feature, i) => {
          const featureDelay = startFrame + index * 12 + 20 + i * 4;
          const featureOpacity = interpolate(
            frame,
            [featureDelay, featureDelay + 10],
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
              <span style={{ color, fontSize: 12 }}>✓</span>
              <span style={{ fontSize: 13, color: "#e2e8f0" }}>{feature}</span>
            </div>
          );
        })}
      </div>

      {/* Files (if provided) */}
      {data.files && data.files.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 8,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {data.files.slice(0, 4).map((file, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                fontFamily: "Menlo, Monaco, monospace",
                color,
                backgroundColor: `${color}20`,
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              {file}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PhaseComparison: React.FC<PhaseComparisonProps> = ({
  skillName,
  skillCommand,
  hook,
  tagline,
  primaryColor,
  phases,
  summary,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Timeline
  const hookDuration = fps * 2;
  const phaseDuration = fps * 2.5; // Time per phase
  const phaseSceneDuration = phases.length * phaseDuration;
  const summaryStart = hookDuration + phaseSceneDuration;

  // Calculate current phase based on frame
  const phaseSceneFrame = Math.max(0, frame - hookDuration);

  // Phase completion status
  const getPhaseStatus = (index: number) => {
    const phaseStartFrame = index * phaseDuration;
    const phaseEndFrame = phaseStartFrame + phaseDuration;

    if (phaseSceneFrame >= phaseEndFrame) return "complete";
    if (phaseSceneFrame >= phaseStartFrame) return "active";
    return "pending";
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 20% 20%, ${LEVEL_COLORS.simple}08 0%, transparent 40%),
            radial-gradient(ellipse at 50% 50%, ${LEVEL_COLORS.medium}06 0%, transparent 40%),
            radial-gradient(ellipse at 80% 80%, ${LEVEL_COLORS.advanced}08 0%, transparent 40%)
          `,
        }}
      />

      {/* Hook Scene */}
      <Sequence from={0} durationInFrames={hookDuration}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#f8fafc",
              textAlign: "center",
              opacity: interpolate(frame, [0, 15], [0, 1]),
            }}
          >
            {hook}
          </div>
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 24,
              color: primaryColor,
              opacity: interpolate(frame, [15, 30], [0, 1]),
            }}
          >
            {skillCommand}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Phase Progression Scene */}
      <Sequence from={hookDuration} durationInFrames={phaseSceneDuration}>
        <AbsoluteFill style={{ padding: 24 }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "Menlo, Monaco, monospace",
                  fontSize: 16,
                  color: primaryColor,
                }}
              >
                {skillCommand}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                {tagline}
              </div>
            </div>

            {/* Progress indicator */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {phases.map((phase, i) => {
                const status = getPhaseStatus(i);
                const bgColor =
                  status === "complete"
                    ? "#22c55e"
                    : status === "active"
                      ? primaryColor
                      : "#2d2d4a";

                return (
                  <div
                    key={i}
                    style={{
                      width: 32,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: bgColor,
                      transition: "background-color 0.3s",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Phase Rows - Scrollable area */}
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {phases.map((phase, index) => {
              const status = getPhaseStatus(index);
              const phaseStartFrame = hookDuration + index * phaseDuration;

              return (
                <PhaseRow
                  key={phase.name}
                  phase={phase}
                  phaseIndex={index}
                  isActive={status === "active"}
                  isComplete={status === "complete"}
                  startFrame={phaseStartFrame}
                  primaryColor={primaryColor}
                />
              );
            })}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Summary Scene */}
      <Sequence from={summaryStart} durationInFrames={durationInFrames - summaryStart}>
        <AbsoluteFill style={{ padding: 40 }}>
          {/* Title */}
          <div
            style={{
              textAlign: "center",
              marginBottom: 32,
              opacity: interpolate(frame - summaryStart, [0, 15], [0, 1]),
            }}
          >
            <div style={{ fontSize: 40, fontWeight: 700, color: "#f8fafc" }}>
              ✅ {skillName} Complete
            </div>
            <div style={{ fontSize: 18, color: "#94a3b8", marginTop: 8 }}>
              {tagline}
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
            <SummaryCard
              level="simple"
              data={summary.simple}
              startFrame={summaryStart + 20}
              index={0}
            />
            <SummaryCard
              level="medium"
              data={summary.medium}
              startFrame={summaryStart + 20}
              index={1}
            />
            <SummaryCard
              level="advanced"
              data={summary.advanced}
              startFrame={summaryStart + 20}
              index={2}
            />
          </div>

          {/* Phases Completed */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              marginBottom: 32,
              opacity: interpolate(frame - summaryStart, [60, 75], [0, 1]),
            }}
          >
            {phases.map((phase, i) => (
              <React.Fragment key={phase.name}>
                <div
                  style={{
                    backgroundColor: `${primaryColor}20`,
                    border: `1px solid ${primaryColor}40`,
                    borderRadius: 8,
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "#22c55e", fontSize: 14 }}>✓</span>
                  <span style={{ color: "#f8fafc", fontSize: 13 }}>
                    {phase.shortName || phase.name}
                  </span>
                </div>
                {i < phases.length - 1 && (
                  <span style={{ color: "#4b5563", alignSelf: "center" }}>→</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* CTA */}
          <div
            style={{
              textAlign: "center",
              opacity: interpolate(frame - summaryStart, [80, 95], [0, 1]),
            }}
          >
            <div
              style={{
                display: "inline-block",
                backgroundColor: `${primaryColor}15`,
                border: `2px solid ${primaryColor}`,
                borderRadius: 12,
                padding: "14px 28px",
              }}
            >
              <span style={{ fontSize: 13, color: "#9ca3af", marginRight: 8 }}>
                Try it:
              </span>
              <span
                style={{
                  fontFamily: "Menlo, Monaco, monospace",
                  fontSize: 18,
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

export default PhaseComparison;
