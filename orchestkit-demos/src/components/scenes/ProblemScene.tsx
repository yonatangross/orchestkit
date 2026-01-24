import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

interface ProblemSceneProps {
  problems: string[];
  primaryColor?: string;
  title?: string;
}

export const ProblemScene: React.FC<ProblemSceneProps> = ({
  problems,
  primaryColor = "#ef4444",
  title = "Before OrchestKit",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0a0a0f",
      }}
    >
      {/* Subtle red warning glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${primaryColor}10 0%, transparent 60%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          maxWidth: 1000,
        }}
      >
        {/* Title */}
        <div
          style={{
            transform: `scale(${titleScale})`,
            opacity: Math.min(1, frame / 10),
          }}
        >
          <h2
            style={{
              fontSize: 28,
              color: "#6b7280",
              fontFamily: "Inter, system-ui",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              margin: 0,
            }}
          >
            {title}
          </h2>
        </div>

        {/* Problem List */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {problems.map((problem, index) => {
            const itemDelay = 15 + index * 12;
            const itemScale = spring({
              frame: Math.max(0, frame - itemDelay),
              fps,
              config: { damping: 80, stiffness: 200 },
            });
            const itemOpacity = interpolate(
              frame,
              [itemDelay, itemDelay + 10],
              [0, 1],
              { extrapolateRight: "clamp" }
            );

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  transform: `scale(${itemScale})`,
                  opacity: itemOpacity,
                }}
              >
                {/* X Icon */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: `${primaryColor}20`,
                    border: `2px solid ${primaryColor}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    color: primaryColor,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ✗
                </div>

                {/* Problem Text */}
                <span
                  style={{
                    fontSize: 26,
                    color: "#e5e7eb",
                    fontFamily: "Inter, system-ui",
                    fontWeight: 400,
                  }}
                >
                  {problem}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
