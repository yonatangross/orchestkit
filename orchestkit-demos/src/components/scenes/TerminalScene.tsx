import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";

interface TerminalSceneProps {
  videoPath: string;
  showHeader?: boolean;
  headerText?: string;
  primaryColor?: string;
}

export const TerminalScene: React.FC<TerminalSceneProps> = ({
  videoPath,
  showHeader = false,
  headerText,
  primaryColor = "#8b5cf6",
}) => {
  const frame = useCurrentFrame();

  // Subtle zoom pulse during key moments
  const scale = interpolate(
    frame,
    [0, 10, 30, 40],
    [0.98, 1, 1.01, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Optional header */}
      {showHeader && headerText && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 10,
            opacity: interpolate(frame, [0, 15], [0, 0.8], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: primaryColor,
              fontFamily: "Menlo, monospace",
              backgroundColor: "rgba(10,10,15,0.8)",
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${primaryColor}40`,
            }}
          >
            {headerText}
          </span>
        </div>
      )}

      {/* Terminal video */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        <OffthreadVideo
          src={staticFile(videoPath)}
          style={{
            width: "100%",
            maxHeight: "90%",
            objectFit: "contain",
          }}
        />
      </AbsoluteFill>

      {/* Subtle vignette overlay */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// Terminal with text overlay for narration
interface TerminalWithOverlayProps extends TerminalSceneProps {
  overlayText?: string;
  overlayPosition?: "top" | "bottom";
  showOverlayAt?: number;
  hideOverlayAt?: number;
}

export const TerminalWithOverlay: React.FC<TerminalWithOverlayProps> = ({
  videoPath,
  overlayText,
  overlayPosition = "bottom",
  showOverlayAt = 0,
  hideOverlayAt = 999,
  primaryColor = "#8b5cf6",
}) => {
  const frame = useCurrentFrame();

  const overlayOpacity = interpolate(
    frame,
    [showOverlayAt, showOverlayAt + 15, hideOverlayAt - 15, hideOverlayAt],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Terminal video */}
      <TerminalScene videoPath={videoPath} primaryColor={primaryColor} />

      {/* Text overlay */}
      {overlayText && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            [overlayPosition]: 60,
            textAlign: "center",
            opacity: overlayOpacity,
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "inline-block",
              backgroundColor: "rgba(10,10,15,0.9)",
              padding: "12px 24px",
              borderRadius: 12,
              border: `1px solid ${primaryColor}40`,
            }}
          >
            <span
              style={{
                fontSize: 20,
                color: "white",
                fontFamily: "Inter, system-ui",
                fontWeight: 500,
              }}
            >
              {overlayText}
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
