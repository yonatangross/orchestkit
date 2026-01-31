import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export type PhaseStatus = "pending" | "active" | "completed";

export interface Phase {
  name: string;
  status: PhaseStatus;
  shortName?: string;
}

export interface ProgressPhasesProps {
  phases: Phase[];
  currentPhase?: number;
  progress?: number; // 0-100
  primaryColor?: string;
  animateIn?: boolean;
  startFrame?: number;
  showProgressBar?: boolean;
  layout?: "horizontal" | "vertical";
}

const STATUS_ICONS: Record<PhaseStatus, string> = {
  pending: "○",
  active: "▶",
  completed: "✓",
};

const STATUS_COLORS: Record<PhaseStatus, string> = {
  pending: "#4b5563",
  active: "#f59e0b",
  completed: "#22c55e",
};

export const ProgressPhases: React.FC<ProgressPhasesProps> = ({
  phases,
  currentPhase = 0,
  progress = 0,
  primaryColor = "#8b5cf6",
  animateIn = true,
  startFrame = 0,
  showProgressBar = true,
  layout = "horizontal",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Container animation
  const containerOpacity = animateIn
    ? interpolate(frame - startFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
        extrapolateLeft: "clamp",
      })
    : 1;

  // Progress bar animation
  const progressWidth = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 50, stiffness: 100 },
  }) * progress;

  const isHorizontal = layout === "horizontal";

  return (
    <div
      style={{
        backgroundColor: "rgba(10, 10, 15, 0.9)",
        borderRadius: 6,
        padding: 12,
        opacity: containerOpacity,
      }}
    >
      {/* Progress Bar */}
      {showProgressBar && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              height: 6,
              backgroundColor: "#1f2937",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressWidth}%`,
                height: "100%",
                backgroundColor: primaryColor,
                borderRadius: 3,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 11,
              color: "#6b7280",
              textAlign: "right",
            }}
          >
            {Math.round(progress)}%
          </div>
        </div>
      )}

      {/* Phases */}
      <div
        style={{
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column",
          gap: isHorizontal ? 4 : 8,
          flexWrap: isHorizontal ? "wrap" : "nowrap",
        }}
      >
        {phases.map((phase, index) => {
          const itemDelay = startFrame + index * 5;
          const statusColor = STATUS_COLORS[phase.status];
          const statusIcon = STATUS_ICONS[phase.status];

          const itemOpacity = interpolate(
            frame,
            [itemDelay, itemDelay + 10],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );

          // Active phase pulse
          const isActive = phase.status === "active";
          const pulse = isActive ? 1 + 0.1 * Math.sin(frame * 0.2) : 1;

          return (
            <div
              key={phase.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                opacity: itemOpacity,
                transform: `scale(${pulse})`,
                padding: "4px 8px",
                backgroundColor: isActive ? `${primaryColor}20` : "transparent",
                borderRadius: 4,
                border: isActive ? `1px solid ${primaryColor}40` : "1px solid transparent",
              }}
            >
              {/* Status icon */}
              <span
                style={{
                  color: statusColor,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {statusIcon}
              </span>

              {/* Phase name */}
              <span
                style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: 11,
                  color: isActive ? "#f8fafc" : "#9ca3af",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {phase.shortName || phase.name}
              </span>

              {/* Connector (horizontal only) */}
              {isHorizontal && index < phases.length - 1 && (
                <span style={{ color: "#4b5563", marginLeft: 4 }}>→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Current phase label */}
      <div
        style={{
          marginTop: 8,
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 11,
          color: primaryColor,
        }}
      >
        Phase: {phases[currentPhase]?.name || "Unknown"}
      </div>
    </div>
  );
};

// Compact progress bar for terminal footer
export const CompactProgressBar: React.FC<{
  progress: number;
  phaseName: string;
  phaseNumber: number;
  totalPhases: number;
  primaryColor?: string;
}> = ({
  progress,
  phaseName,
  phaseNumber,
  totalPhases,
  primaryColor = "#8b5cf6",
}) => {
  // Animated progress fill
  const fillChar = "▓";
  const emptyChar = "░";
  const barWidth = 40;
  const filledWidth = Math.round((progress / 100) * barWidth);

  const progressBar =
    fillChar.repeat(filledWidth) + emptyChar.repeat(barWidth - filledWidth);

  return (
    <div
      style={{
        backgroundColor: "rgba(10, 10, 15, 0.95)",
        padding: "8px 12px",
        borderTop: `1px solid ${primaryColor}33`,
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 12,
          color: primaryColor,
          marginBottom: 4,
        }}
      >
        {progressBar} {Math.round(progress)}%
      </div>

      {/* Phase indicator */}
      <div
        style={{
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 11,
          color: "#6b7280",
        }}
      >
        Phase {phaseNumber}/{totalPhases}: {phaseName}
      </div>
    </div>
  );
};
