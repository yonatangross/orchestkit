import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";

interface ManimSceneProps {
  videoPath: string;
  title?: string;
  subtitle?: string;
  position?: "center" | "top" | "bottom";
  scale?: number;
}

export const ManimScene: React.FC<ManimSceneProps> = ({
  videoPath,
  title,
  subtitle,
  position = "center",
  scale = 1,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const videoScale = interpolate(frame, [0, 20], [0.95, scale], {
    extrapolateRight: "clamp",
  });

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case "top":
        return {
          justifyContent: "flex-start",
          paddingTop: 100,
        };
      case "bottom":
        return {
          justifyContent: "flex-end",
          paddingBottom: 100,
        };
      default:
        return {
          justifyContent: "center",
        };
    }
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        alignItems: "center",
        ...getPositionStyles(),
      }}
    >
      {/* Optional title */}
      {title && (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: interpolate(frame, [5, 15], [0, 0.7], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          <h3
            style={{
              fontSize: 18,
              color: "#6b7280",
              fontFamily: "Menlo, monospace",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              margin: 0,
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              style={{
                fontSize: 14,
                color: "#4b5563",
                fontFamily: "Inter, system-ui",
                marginTop: 8,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Manim video overlay */}
      <div
        style={{
          opacity,
          transform: `scale(${videoScale})`,
        }}
      >
        <OffthreadVideo
          src={staticFile(videoPath)}
          style={{
            maxWidth: "100%",
            maxHeight: "80vh",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Subtle vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(10,10,15,0.5) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// Fallback for when Manim video isn't available
interface ManimPlaceholderProps {
  type: "agent-spawning" | "task-dependency" | "workflow";
  agentCount?: number;
  primaryColor?: string;
}

export const ManimPlaceholder: React.FC<ManimPlaceholderProps> = ({
  type,
  agentCount = 6,
  primaryColor = "#8b5cf6",
}) => {
  const frame = useCurrentFrame();

  const getContent = () => {
    switch (type) {
      case "agent-spawning":
        return (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
            }}
          >
            <div
              style={{
                fontSize: 48,
                color: primaryColor,
              }}
            >
              ⚡
            </div>
            <h3
              style={{
                fontSize: 24,
                color: "white",
                fontFamily: "Inter, system-ui",
                fontWeight: 600,
              }}
            >
              Spawning {agentCount} Parallel Agents
            </h3>
            <div
              style={{
                display: "flex",
                gap: 16,
              }}
            >
              {Array.from({ length: agentCount }).map((_, i) => {
                const delay = i * 5;
                const opacity = interpolate(
                  frame,
                  [delay, delay + 10],
                  [0, 1],
                  { extrapolateRight: "clamp" }
                );
                const scale = interpolate(
                  frame,
                  [delay, delay + 10],
                  [0.5, 1],
                  { extrapolateRight: "clamp" }
                );

                return (
                  <div
                    key={i}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: `${primaryColor}30`,
                      border: `2px solid ${primaryColor}`,
                      opacity,
                      transform: `scale(${scale})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    🤖
                  </div>
                );
              })}
            </div>
          </div>
        );
      case "task-dependency":
        return (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>📋</div>
            <h3
              style={{
                fontSize: 24,
                color: "white",
                fontFamily: "Inter, system-ui",
              }}
            >
              Task Dependency Graph
            </h3>
          </div>
        );
      default:
        return (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>🎬</div>
            <h3
              style={{
                fontSize: 24,
                color: "white",
                fontFamily: "Inter, system-ui",
              }}
            >
              Animation Placeholder
            </h3>
          </div>
        );
    }
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {getContent()}
    </AbsoluteFill>
  );
};
