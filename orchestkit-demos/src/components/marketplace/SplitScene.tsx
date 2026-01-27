import React from "react";
import { AbsoluteFill, spring, interpolate } from "remotion";

/**
 * SplitScene - Side-by-side layout with "Studio Stage" background
 * Radial gradient spotlight + subtle floor reflection
 */

const SLAM = { stiffness: 300, damping: 15 };

interface SplitSceneProps {
  frame: number;
  fps: number;
  toyComponent: React.ReactNode;
  terminalComponent: React.ReactNode;
}

export const SplitScene: React.FC<SplitSceneProps> = ({
  frame,
  fps,
  toyComponent,
  terminalComponent,
}) => {
  const leftProgress = spring({ frame, fps, config: SLAM });
  const rightProgress = spring({ frame: Math.max(0, frame - 5), fps, config: SLAM });

  const PAD = 20;
  const GAP = 16;
  const LEFT_PCT = 0.38;

  return (
    <AbsoluteFill
      style={{
        // Studio spotlight background instead of flat black
        background: "radial-gradient(ellipse at 35% 45%, #1a1b26 0%, #0d0d14 50%, #050508 100%)",
      }}
    >
      {/* LEFT SIDE: TOY */}
      <div
        style={{
          position: "absolute",
          top: PAD,
          left: PAD,
          width: `calc(${LEFT_PCT * 100}% - ${PAD + GAP / 2}px)`,
          bottom: PAD,
          borderRadius: 16,
          overflow: "hidden",
          transform: `translateX(${interpolate(leftProgress, [0, 1], [-40, 0])}px) scale(${interpolate(leftProgress, [0, 1], [0.95, 1])})`,
          opacity: leftProgress,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: "scale(0.85)",
            transformOrigin: "center center",
          }}
        >
          {toyComponent}
        </div>

        {/* Border glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            border: "1px solid rgba(168, 85, 247, 0.25)",
            boxShadow: "inset 0 0 30px rgba(168, 85, 247, 0.05)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* RIGHT SIDE: TERMINAL */}
      <div
        style={{
          position: "absolute",
          top: PAD,
          left: `calc(${LEFT_PCT * 100}% + ${GAP / 2}px)`,
          right: PAD,
          bottom: PAD,
          borderRadius: 16,
          overflow: "hidden",
          transform: `translateX(${interpolate(rightProgress, [0, 1], [40, 0])}px) scale(${interpolate(rightProgress, [0, 1], [0.95, 1])})`,
          opacity: rightProgress,
        }}
      >
        {terminalComponent}

        {/* Border glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            border: "1px solid rgba(34, 197, 94, 0.2)",
            boxShadow: "inset 0 0 30px rgba(34, 197, 94, 0.03)",
            pointerEvents: "none",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
