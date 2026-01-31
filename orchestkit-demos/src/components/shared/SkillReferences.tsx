import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type ReferenceStatus = "loading" | "loaded" | "pending";

export interface SkillReference {
  name: string;
  status: ReferenceStatus;
  category?: string;
}

export interface SkillReferencesProps {
  references: SkillReference[];
  title?: string;
  primaryColor?: string;
  animateIn?: boolean;
  startFrame?: number;
  compact?: boolean;
}

const STATUS_CONFIG: Record<
  ReferenceStatus,
  { icon: string; color: string }
> = {
  loading: { icon: "⏳", color: "#f59e0b" },
  loaded: { icon: "✓", color: "#22c55e" },
  pending: { icon: "○", color: "#6b7280" },
};

export const SkillReferences: React.FC<SkillReferencesProps> = ({
  references,
  title = "⚙️ Loading skill refs...",
  primaryColor = "#8b5cf6",
  animateIn = true,
  startFrame = 0,
  compact = false,
}) => {
  const frame = useCurrentFrame();
  useVideoConfig(); // For consistency with other components

  // Container animation
  const containerOpacity = animateIn
    ? interpolate(frame - startFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
        extrapolateLeft: "clamp",
      })
    : 1;

  return (
    <div
      style={{
        backgroundColor: compact ? "transparent" : "rgba(10, 10, 15, 0.8)",
        borderRadius: compact ? 0 : 6,
        padding: compact ? 8 : 12,
        border: compact ? "none" : `1px solid ${primaryColor}22`,
        opacity: containerOpacity,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: compact ? 11 : 12,
          color: "#9ca3af",
          marginBottom: 8,
        }}
      >
        {title}
      </div>

      {/* Reference list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compact ? 4 : 6,
        }}
      >
        {references.map((ref, index) => {
          const itemDelay = startFrame + index * 8;
          const statusConfig = STATUS_CONFIG[ref.status];

          // Per-item animation
          const itemOpacity = interpolate(
            frame,
            [itemDelay, itemDelay + 10],
            [0, 1],
            { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
          );

          // Loading spinner animation
          const isLoading = ref.status === "loading";
          const loadingRotate = isLoading ? frame * 10 : 0;

          return (
            <div
              key={ref.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: itemOpacity,
                fontFamily: "Menlo, Monaco, monospace",
                fontSize: compact ? 10 : 11,
              }}
            >
              {/* Tree connector */}
              <span style={{ color: "#4b5563" }}>
                {index === references.length - 1 ? "└─" : "├─"}
              </span>

              {/* Status icon */}
              <span
                style={{
                  color: statusConfig.color,
                  transform: isLoading ? `rotate(${loadingRotate}deg)` : "none",
                  display: "inline-block",
                }}
              >
                {statusConfig.icon}
              </span>

              {/* Reference name */}
              <span style={{ color: "#e2e8f0" }}>{ref.name}</span>

              {/* Category tag (optional) */}
              {ref.category && (
                <span
                  style={{
                    fontSize: 9,
                    color: primaryColor,
                    backgroundColor: `${primaryColor}20`,
                    padding: "1px 4px",
                    borderRadius: 3,
                  }}
                >
                  {ref.category}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Inline version for embedding in terminal output
export const InlineSkillReferences: React.FC<{
  references: SkillReference[];
  startFrame?: number;
}> = ({ references, startFrame = 0 }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      {references.map((ref, index) => {
        const itemDelay = startFrame + index * 6;
        const statusConfig = STATUS_CONFIG[ref.status];

        const itemOpacity = interpolate(
          frame,
          [itemDelay, itemDelay + 8],
          [0, 1],
          { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
        );

        return (
          <div
            key={ref.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: itemOpacity,
              fontFamily: "Menlo, Monaco, monospace",
              fontSize: 11,
              lineHeight: 1.6,
              paddingLeft: 16,
            }}
          >
            <span style={{ color: "#4b5563" }}>
              {index === references.length - 1 ? "└─" : "├─"}
            </span>
            <span style={{ color: statusConfig.color }}>{statusConfig.icon}</span>
            <span style={{ color: "#94a3b8" }}>{ref.name}</span>
          </div>
        );
      })}
    </div>
  );
};
