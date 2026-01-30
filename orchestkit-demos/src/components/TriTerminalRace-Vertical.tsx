/**
 * TriTerminalRace - Vertical 9:16 Variant
 *
 * Vertical layout for TikTok/Reels format (9:16 aspect ratio)
 * Stacks terminals vertically instead of horizontally
 * Optimized for mobile viewing with compact content
 *
 * Format adjustments from video-pacing:
 * - TikTok: 20-40 cuts/min, 1.5-3s shots → Use shorter phase sequences
 * - Reels: 15-30 cuts/min, 2-4s shots → Balance detail with readability
 * - Hook: 0.5s for TikTok, 1s for Reels → Adjusted timing
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
import {
  LiveFolderTree,
  CompactProgressBar,
  CompactClaudeResponse,
  CodePreview,
} from "./shared";
import type {
  FileNode,
  Phase,
  DifficultyLevel,
} from "./shared";

// Reuse same schema as horizontal version
const levelConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputCount: z.number(),
  files: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["completed", "writing", "pending", "modified"]),
      lines: z.number().optional(),
      children: z.array(z.any()).optional(),
    })
  ),
  references: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["loading", "loaded", "pending"]),
      category: z.string().optional(),
    })
  ),
  claudeResponse: z.array(z.string()),
  codeSnippet: z.string().optional(),
  completionTime: z.string(),
  metrics: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const triTerminalRaceVerticalSchema = z.object({
  skillName: z.string(),
  skillCommand: z.string(),
  hook: z.string(),
  primaryColor: z.string().default("#8b5cf6"),
  secondaryColor: z.string().default("#22c55e"),
  accentColor: z.string().default("#f59e0b"),

  simple: levelConfigSchema,
  medium: levelConfigSchema,
  advanced: levelConfigSchema,

  phases: z.array(
    z.object({
      name: z.string(),
      shortName: z.string().optional(),
    })
  ),

  backgroundMusic: z.string().optional(),
  musicVolume: z.number().default(0.1),

  summaryTitle: z.string().default("📊 RESULTS COMPARISON"),
  summaryTagline: z.string().default("Same skill. Any scale. Same quality."),
});

export type TriTerminalRaceVerticalProps = z.infer<
  typeof triTerminalRaceVerticalSchema
>;

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_COLORS: Record<DifficultyLevel, string> = {
  simple: "#22c55e",
  medium: "#f59e0b",
  advanced: "#8b5cf6",
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface VerticalTerminalPanelProps {
  level: DifficultyLevel;
  config: z.infer<typeof levelConfigSchema>;
  skillCommand: string;
  phases: Phase[];
  currentPhase: number;
  progress: number;
  primaryColor: string;
  startFrame: number;
  showCode: boolean;
}

const VerticalTerminalPanel: React.FC<VerticalTerminalPanelProps> = ({
  level,
  config,
  skillCommand,
  phases,
  currentPhase,
  progress,
  primaryColor,
  startFrame,
  showCode,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const levelColor = LEVEL_COLORS[level];

  // Panel entry animation
  const panelOpacity = interpolate(frame - startFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const panelScale = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 60, stiffness: 150 },
  });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0a0f",
        borderRadius: 8,
        overflow: "hidden",
        border: `1px solid ${levelColor}33`,
        opacity: panelOpacity,
        transform: `scale(${panelScale})`,
        marginBottom: 8,
      }}
    >
      {/* Compact header */}
      <div
        style={{
          backgroundColor: "#1a1a2e",
          padding: "6px 10px",
          borderBottom: `1px solid ${levelColor}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10 }}>🖥️</span>
          <span
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 9,
              color: "#94a3b8",
            }}
          >
            TERMINAL
          </span>
        </div>
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 9,
            fontWeight: 600,
            color: levelColor,
            backgroundColor: `${levelColor}20`,
            padding: "1px 6px",
            borderRadius: 3,
          }}
        >
          {level.toUpperCase()}
        </span>
      </div>

      {/* Compact content area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 8,
          gap: 8,
          overflow: "hidden",
          fontSize: 9,
        }}
      >
        {/* Folder tree (compact) */}
        <LiveFolderTree
          files={config.files.slice(0, 3) as FileNode[]} // Show only first 3 files
          title="📁 Files"
          totalFiles={config.files.length}
          totalLines={config.files.reduce((sum, f) => sum + (f.lines || 0), 0)}
          primaryColor={levelColor}
          startFrame={startFrame + 5}
        />

        {/* Command prompt */}
        <div
          style={{
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 8,
            color: "#e2e8f0",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <span style={{ color: "#22c55e" }}>❯</span>{" "}
          <span style={{ color: primaryColor }}>{skillCommand}</span>
        </div>

        {/* Claude response (compact) */}
        <CompactClaudeResponse
          lines={config.claudeResponse.slice(0, 2)} // Show only first 2 lines
          startFrame={startFrame + 10}
          primaryColor={levelColor}
        />

        {/* Skill references (icon-only) */}
        {config.references.length > 0 && (
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 8,
              color: "#6b7280",
            }}
          >
            ⚙️ {config.references.length} refs
          </div>
        )}

        {/* Code preview (hidden for vertical, shown in summary) */}
        {showCode && config.codeSnippet && (
          <CodePreview
            code={config.codeSnippet.slice(0, 100) + "..."} // First 100 chars
            filename={config.files[0]?.name || "code.ts"}
            primaryColor={levelColor}
            startFrame={startFrame + 20}
            typewriterSpeed={8}
          />
        )}
      </div>

      {/* Progress bar footer (compact) */}
      <CompactProgressBar
        progress={progress}
        phaseName={phases[currentPhase]?.shortName || "..."}
        phaseNumber={currentPhase + 1}
        totalPhases={phases.length}
        primaryColor={levelColor}
      />
    </div>
  );
};

// Summary Card Component (vertical optimized)
interface VerticalSummaryCardProps {
  simple: z.infer<typeof levelConfigSchema>;
  medium: z.infer<typeof levelConfigSchema>;
  advanced: z.infer<typeof levelConfigSchema>;
  title: string;
  tagline: string;
  skillCommand: string;
  startFrame: number;
}

const VerticalSummaryCard: React.FC<VerticalSummaryCardProps> = ({
  simple,
  medium,
  advanced,
  title,
  tagline,
  skillCommand,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardOpacity = interpolate(frame - startFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const cardScale = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 50, stiffness: 120 },
  });

  const levels = [
    { config: simple, level: "simple" as const, color: "#22c55e", emoji: "🟢" },
    { config: medium, level: "medium" as const, color: "#f59e0b", emoji: "🟡" },
    {
      config: advanced,
      level: "advanced" as const,
      color: "#8b5cf6",
      emoji: "🟣",
    },
  ];

  return (
    <div
      style={{
        backgroundColor: "rgba(10, 10, 15, 0.98)",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #2d2d4a",
        opacity: cardOpacity,
        transform: `scale(${cardScale})`,
        width: "95%",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 18,
          fontWeight: 700,
          color: "#f8fafc",
          textAlign: "center",
          marginBottom: 16,
        }}
      >
        {title}
      </div>

      {/* Level cards - stacked vertically */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {levels.map(({ config, level, color, emoji }, index) => {
          const cardDelay = startFrame + 8 + index * 6;
          const itemOpacity = interpolate(
            frame,
            [cardDelay, cardDelay + 12],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );

          return (
            <div
              key={level}
              style={{
                backgroundColor: `${color}10`,
                borderRadius: 8,
                padding: 12,
                border: `2px solid ${color}`,
                opacity: itemOpacity,
              }}
            >
              {/* Level header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 14 }}>{emoji}</span>
                <span
                  style={{
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    color,
                  }}
                >
                  {level.toUpperCase()}
                </span>
              </div>

              {/* Metrics - compact grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  fontSize: 10,
                }}
              >
                <MetricBadgeCompact
                  icon="📁"
                  label="Files"
                  value={config.files.length.toString()}
                  color={color}
                />
                <MetricBadgeCompact
                  icon="📝"
                  label="Time"
                  value={config.completionTime}
                  color={color}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 12,
          color: "#94a3b8",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        🎯 {tagline}
      </div>

      {/* CTA */}
      <div
        style={{
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 11,
          color: "#8b5cf6",
          textAlign: "center",
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          padding: "8px 12px",
          borderRadius: 6,
          border: "1px solid rgba(139, 92, 246, 0.3)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        Try: {skillCommand}
      </div>
    </div>
  );
};

const MetricBadgeCompact: React.FC<{
  icon: string;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      padding: "6px 8px",
      backgroundColor: `${color}15`,
      borderRadius: 6,
      border: `1px solid ${color}30`,
    }}
  >
    <span style={{ fontSize: 10 }}>{icon}</span>
    <span style={{ color, fontWeight: 600, fontSize: 9 }}>{value}</span>
    <span style={{ color: "#6b7280", fontSize: 7 }}>{label}</span>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TriTerminalRaceVertical: React.FC<
  TriTerminalRaceVerticalProps
> = ({
  skillName,
  skillCommand,
  hook,
  primaryColor,
  simple,
  medium,
  advanced,
  phases,
  summaryTitle,
  summaryTagline,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Adjusted timeline for vertical format (shorter phases per video-pacing)
  const hookDuration = fps * 1; // 1 second hook (vs 2 for horizontal)
  const raceDuration = fps * 12; // 12 seconds race (vs 15 for horizontal)
  const summaryStart = hookDuration + raceDuration;

  // Progress calculations for each level
  const raceProgress = Math.min(
    100,
    ((frame - hookDuration) / raceDuration) * 100
  );
  const simpleProgress = Math.min(100, raceProgress * 1.3);
  const mediumProgress = Math.min(100, raceProgress * 1.0);
  const advancedProgress = Math.min(100, raceProgress * 0.7);

  // Current phase calculation
  const phaseObjects: Phase[] = phases.map((p, i) => ({
    name: p.name,
    shortName: p.shortName,
    status:
      raceProgress > (i + 1) * (100 / phases.length)
        ? "completed"
        : raceProgress > i * (100 / phases.length)
          ? "active"
          : "pending",
  }));

  const currentPhase = Math.min(
    Math.floor((raceProgress / 100) * phases.length),
    phases.length - 1
  );

  const showCode = raceProgress > 60;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}15 0%, transparent 60%)`,
        }}
      />

      {/* Hook Scene */}
      <Sequence durationInFrames={hookDuration}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 32,
              fontWeight: 700,
              color: "#f8fafc",
              textAlign: "center",
              paddingLeft: 16,
            paddingRight: 16,
              opacity: interpolate(frame, [0, 10], [0, 1]),
            }}
          >
            {hook}
          </div>
          <div
            style={{
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 16,
              color: primaryColor,
              opacity: interpolate(frame, [10, 20], [0, 1]),
            }}
          >
            /ork:{skillName}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Race Scene - 3 Terminals Stacked Vertically */}
      <Sequence from={hookDuration} durationInFrames={raceDuration}>
        <AbsoluteFill
          style={{
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <VerticalTerminalPanel
            level="simple"
            config={simple}
            skillCommand={skillCommand}
            phases={phaseObjects}
            currentPhase={Math.min(currentPhase, phases.length - 1)}
            progress={simpleProgress}
            primaryColor={primaryColor}
            startFrame={0}
            showCode={showCode && simpleProgress === 100}
          />
          <VerticalTerminalPanel
            level="medium"
            config={medium}
            skillCommand={skillCommand}
            phases={phaseObjects}
            currentPhase={Math.min(currentPhase, phases.length - 1)}
            progress={mediumProgress}
            primaryColor={primaryColor}
            startFrame={3}
            showCode={showCode && mediumProgress === 100}
          />
          <VerticalTerminalPanel
            level="advanced"
            config={advanced}
            skillCommand={skillCommand}
            phases={phaseObjects}
            currentPhase={Math.min(currentPhase, phases.length - 1)}
            progress={advancedProgress}
            primaryColor={primaryColor}
            startFrame={6}
            showCode={showCode && advancedProgress === 100}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Summary Scene */}
      <Sequence from={summaryStart} durationInFrames={durationInFrames - summaryStart}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <VerticalSummaryCard
            simple={simple}
            medium={medium}
            advanced={advanced}
            title={summaryTitle}
            tagline={summaryTagline}
            skillCommand={skillCommand}
            startFrame={0}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 8,
          color: "#4b5563",
        }}
      >
        OrchestKit
      </div>
    </AbsoluteFill>
  );
};

export default TriTerminalRaceVertical;
