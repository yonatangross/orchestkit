/**
 * TriTerminalRace - Enhanced Demo Template
 *
 * Shows a single user-invocable skill running in 3 parallel terminals
 * at different difficulty levels (Simple, Medium, Advanced).
 *
 * Features:
 * - Live folder tree visualization at top of each terminal
 * - Level badges (🟢 Simple, 🟡 Medium, 🟣 Advanced)
 * - Claude response rendering with typewriter effect
 * - Skill reference loading visualization
 * - Progress phases indicator
 * - Summary comparison card at end
 *
 * Usage:
 * Configure with a SkillDemoConfig to showcase any user-invocable skill.
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
  Audio,
  staticFile,
} from "remotion";
import {
  LiveFolderTree,
  SkillReferences,
  CompactProgressBar,
  CompactClaudeResponse,
  CodePreview,
  SkillResultsSummary,
} from "./shared";
import type {
  FileNode,
  SkillReference,
  Phase,
  DifficultyLevel,
} from "./shared";

// ============================================================================
// HELPERS
// ============================================================================

// Extract all file names from nested file structure (for achievements)
function getAllFileNames(files: FileNode[]): string[] {
  const names: string[] = [];
  function traverse(nodes: FileNode[]) {
    for (const node of nodes) {
      // Only add actual files (not directories)
      if (node.lines && node.lines > 0) {
        names.push(node.name);
      }
      if (node.children) {
        traverse(node.children as FileNode[]);
      }
    }
  }
  traverse(files);
  return names;
}

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

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

export const triTerminalRaceSchema = z.object({
  skillName: z.string(),
  skillCommand: z.string(),
  hook: z.string(),
  primaryColor: z.string().default("#8b5cf6"),
  secondaryColor: z.string().default("#22c55e"),
  accentColor: z.string().default("#f59e0b"),

  // Level configurations
  simple: levelConfigSchema,
  medium: levelConfigSchema,
  advanced: levelConfigSchema,

  // Phases for progress indicator
  phases: z.array(
    z.object({
      name: z.string(),
      shortName: z.string().optional(),
    })
  ),

  // Audio
  backgroundMusic: z.string().optional(),
  musicVolume: z.number().default(0.1),

  // Summary card config
  summaryTitle: z.string().default("📊 RESULTS COMPARISON"),
  summaryTagline: z.string().default("Same skill. Any scale. Same quality."),
});

export type TriTerminalRaceProps = z.infer<typeof triTerminalRaceSchema>;

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface TerminalPanelProps {
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

const LEVEL_COLORS: Record<DifficultyLevel, string> = {
  simple: "#22c55e",
  medium: "#f59e0b",
  advanced: "#8b5cf6",
};

const TerminalPanel: React.FC<TerminalPanelProps> = ({
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
  const panelOpacity = interpolate(frame - startFrame, [0, 20], [0, 1], {
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
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${levelColor}33`,
        opacity: panelOpacity,
        transform: `scale(${panelScale})`,
      }}
    >
      {/* Header with prominent level badge */}
      <div
        style={{
          backgroundColor: levelColor,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>
            {level === "simple" ? "🟢" : level === "medium" ? "🟡" : "🟣"}
          </span>
          <span
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
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
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 11,
            color: "#ffffffcc",
          }}
        >
          {config.completionTime}
        </span>
      </div>

      {/* Main content area - full width */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 10,
          gap: 8,
          overflow: "hidden",
        }}
      >
        {/* Folder tree - compact */}
        <LiveFolderTree
          files={config.files as FileNode[]}
          title="📁 Files"
          totalFiles={config.files.length}
          totalLines={config.files.reduce(
            (sum, f) => sum + (f.lines || 0),
            0
          )}
          primaryColor={levelColor}
          startFrame={startFrame + 10}
        />

        {/* Command prompt */}
        <div
          style={{
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 11,
            color: "#e2e8f0",
          }}
        >
          <span style={{ color: "#22c55e" }}>❯</span>{" "}
          <span style={{ color: primaryColor }}>{skillCommand}</span>
        </div>

        {/* Claude response */}
        <CompactClaudeResponse
          lines={config.claudeResponse}
          startFrame={startFrame + 20}
          primaryColor={levelColor}
        />

        {/* Skill references - inline */}
        <SkillReferences
          references={config.references as SkillReference[]}
          title="⚙️ Skills"
          primaryColor={levelColor}
          startFrame={startFrame + 40}
          compact
        />

        {/* Code preview (if enabled) */}
        {showCode && config.codeSnippet && (
          <CodePreview
            code={config.codeSnippet}
            filename={config.files[0]?.name || "code.ts"}
            primaryColor={levelColor}
            startFrame={startFrame + 60}
            typewriterSpeed={4}
          />
        )}
      </div>

      {/* Progress bar footer */}
      <CompactProgressBar
        progress={progress}
        phaseName={phases[currentPhase]?.name || "Processing"}
        phaseNumber={currentPhase + 1}
        totalPhases={phases.length}
        primaryColor={levelColor}
      />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TriTerminalRace: React.FC<TriTerminalRaceProps> = ({
  skillName,
  skillCommand,
  hook,
  primaryColor,
  simple,
  medium,
  advanced,
  phases,
  backgroundMusic,
  musicVolume,
  summaryTagline,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Timeline calculations
  const hookDuration = fps * 2; // 2 seconds
  const raceDuration = fps * 15; // 15 seconds for race
  const summaryStart = hookDuration + raceDuration;

  // Progress calculations for each level (they finish at different times)
  const raceProgress = Math.min(
    100,
    ((frame - hookDuration) / raceDuration) * 100
  );
  const simpleProgress = Math.min(100, raceProgress * 1.3); // Finishes first
  const mediumProgress = Math.min(100, raceProgress * 1.0); // Finishes second
  const advancedProgress = Math.min(100, raceProgress * 0.7); // Finishes last

  // Calculate phases PER LEVEL (each level progresses independently)
  const getPhaseObjects = (levelProgress: number): Phase[] =>
    phases.map((p, i) => ({
      name: p.name,
      shortName: p.shortName,
      status:
        levelProgress > (i + 1) * (100 / phases.length)
          ? "completed"
          : levelProgress > i * (100 / phases.length)
            ? "active"
            : "pending",
    }));

  const getCurrentPhase = (levelProgress: number): number =>
    Math.min(
      Math.floor((levelProgress / 100) * phases.length),
      phases.length - 1
    );

  // Phase objects per level
  const simplePhases = getPhaseObjects(simpleProgress);
  const mediumPhases = getPhaseObjects(mediumProgress);
  const advancedPhases = getPhaseObjects(advancedProgress);

  const simpleCurrentPhase = getCurrentPhase(simpleProgress);
  const mediumCurrentPhase = getCurrentPhase(mediumProgress);
  const advancedCurrentPhase = getCurrentPhase(advancedProgress);

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
          background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}15 0%, transparent 50%)`,
        }}
      />

      {/* Audio */}
      {backgroundMusic && (
        <Audio src={staticFile(backgroundMusic)} volume={musicVolume} />
      )}

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
              fontFamily: "Inter, system-ui, sans-serif",
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
            /ork:{skillName}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Race Scene - 3 Terminals SIDE BY SIDE */}
      <Sequence from={hookDuration} durationInFrames={raceDuration}>
        <AbsoluteFill
          style={{
            padding: 16,
            display: "flex",
            flexDirection: "row",
            gap: 12,
          }}
        >
          <TerminalPanel
            level="simple"
            config={simple}
            skillCommand={skillCommand}
            phases={simplePhases}
            currentPhase={simpleCurrentPhase}
            progress={simpleProgress}
            primaryColor={primaryColor}
            startFrame={0}
            showCode={simpleProgress > 80}
          />
          <TerminalPanel
            level="medium"
            config={medium}
            skillCommand={skillCommand}
            phases={mediumPhases}
            currentPhase={mediumCurrentPhase}
            progress={mediumProgress}
            primaryColor={primaryColor}
            startFrame={5}
            showCode={mediumProgress > 80}
          />
          <TerminalPanel
            level="advanced"
            config={advanced}
            skillCommand={skillCommand}
            phases={advancedPhases}
            currentPhase={advancedCurrentPhase}
            progress={advancedProgress}
            primaryColor={primaryColor}
            startFrame={10}
            showCode={advancedProgress > 80}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Summary Scene - Premium Animated Version */}
      <Sequence from={summaryStart} durationInFrames={durationInFrames - summaryStart}>
        <SkillResultsSummary
          skillName={skillName}
          results={[
            {
              level: "simple",
              description: simple.description, // WHAT was built
              metrics: {
                files: simple.files.length,
                lines: simple.files.reduce((sum, f) => sum + (f.lines || 0), 0),
                tests: Number(simple.metrics?.Tests || simple.metrics?.tests) || 0,
                coverage: parseFloat(String(simple.metrics?.Coverage || simple.metrics?.coverage || "0").replace("%", "")) || 0,
                time: simple.completionTime,
              },
              achievements: getAllFileNames(simple.files as FileNode[]).slice(0, 3),
            },
            {
              level: "medium",
              description: medium.description,
              metrics: {
                files: medium.files.length,
                lines: medium.files.reduce((sum, f) => sum + (f.lines || 0), 0),
                tests: Number(medium.metrics?.Tests || medium.metrics?.tests) || 0,
                coverage: parseFloat(String(medium.metrics?.Coverage || medium.metrics?.coverage || "0").replace("%", "")) || 0,
                time: medium.completionTime,
              },
              achievements: getAllFileNames(medium.files as FileNode[]).slice(0, 3),
            },
            {
              level: "advanced",
              description: advanced.description,
              metrics: {
                files: advanced.files.length,
                lines: advanced.files.reduce((sum, f) => sum + (f.lines || 0), 0),
                tests: Number(advanced.metrics?.Tests || advanced.metrics?.tests) || 0,
                coverage: parseFloat(String(advanced.metrics?.Coverage || advanced.metrics?.coverage || "0").replace("%", "")) || 0,
                time: advanced.completionTime,
              },
              achievements: getAllFileNames(advanced.files as FileNode[]).slice(0, 3),
            },
          ]}
          phases={phases} // HOW it progressed
          tagline={summaryTagline}
          primaryColor={primaryColor}
        />
      </Sequence>

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 10,
          color: "#4b5563",
        }}
      >
        OrchestKit Demo
      </div>
    </AbsoluteFill>
  );
};

// Default export
export default TriTerminalRace;
