import React from "react";
import { AbsoluteFill, spring, interpolate } from "remotion";

/**
 * ToyToggle - "CONTEXT" tactile toggle switch
 * Inner shadow groove, floating knob with highlight, squash-stretch overshoot
 */

interface ToyToggleProps {
  frame: number;
  fps: number;
}

export const ToyToggle: React.FC<ToyToggleProps> = ({ frame, fps }) => {
  // Toggle snaps at frame 3
  const toggleProgress = spring({
    frame: Math.max(0, frame - 3),
    fps,
    config: { mass: 2, stiffness: 250, damping: 18 },
  });

  // Overshoot + squash-stretch
  const knobPosition = interpolate(toggleProgress, [0, 0.65, 0.85, 1], [0, 1.2, 0.95, 1]);
  const knobStretchX = interpolate(toggleProgress, [0, 0.3, 0.7, 1], [1, 1.15, 0.95, 1]);
  const knobStretchY = interpolate(toggleProgress, [0, 0.3, 0.7, 1], [1, 0.88, 1.05, 1]);

  // Container recoil shake
  const recoilFrame = Math.max(0, frame - 8);
  const recoilX = spring({ frame: recoilFrame, fps, config: { stiffness: 400, damping: 8 } });
  const shakeX = interpolate(recoilX, [0, 0.3, 0.6, 1], [0, -8, 6, 0]);

  // Background color
  const bgColor = interpolate(toggleProgress, [0, 0.5, 1], [0, 0, 1]);
  const backgroundColor = `rgb(${Math.round(50 + bgColor * 118)}, ${Math.round(50 + bgColor * 35)}, ${Math.round(50 + bgColor * 197)})`;

  // Text opacity
  const amnesiaOpacity = interpolate(toggleProgress, [0, 0.3], [1, 0], { extrapolateRight: "clamp" });
  const loadedOpacity = interpolate(toggleProgress, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 45%, #1a1b26 0%, #050508 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Toggle container with recoil */}
      <div
        style={{
          transform: `translateX(${shakeX}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
        }}
      >
        {/* Label */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#8b949e",
            letterSpacing: 4,
          }}
        >
          1. CONTEXT
        </div>

        {/* Toggle switch - with inner shadow groove */}
        <div
          style={{
            width: 320,
            height: 100,
            borderRadius: 50,
            backgroundColor,
            position: "relative",
            boxShadow: `
              inset 0px 4px 12px rgba(0,0,0,0.6),
              inset 0px -2px 6px rgba(255,255,255,0.05),
              0 10px 40px rgba(168, 85, 247, ${toggleProgress * 0.4}),
              0 0 0 3px rgba(255,255,255,0.08)
            `,
          }}
        >
          {/* Knob with drop shadow + highlight */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: interpolate(knobPosition, [0, 1], [10, 210]),
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(145deg, #ffffff 0%, #e8e8e8 100%)",
              boxShadow: `
                0 5px 15px rgba(0,0,0,0.5),
                0 2px 6px rgba(0,0,0,0.3),
                inset 0 -2px 4px rgba(0,0,0,0.1),
                inset 0 2px 4px rgba(255,255,255,0.9)
              `,
              transform: `scaleX(${knobStretchX}) scaleY(${knobStretchY})`,
            }}
          />

          {/* AMNESIA text */}
          <div
            style={{
              position: "absolute",
              right: 30,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 16,
              fontWeight: 700,
              color: "rgba(255,255,255,0.7)",
              opacity: amnesiaOpacity,
              letterSpacing: 1,
            }}
          >
            AMNESIA
          </div>

          {/* LOADED text */}
          <div
            style={{
              position: "absolute",
              left: 30,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
              fontWeight: 700,
              color: "#ffffff",
              opacity: loadedOpacity,
              letterSpacing: 1,
              textShadow: "0 0 10px rgba(168,85,247,0.5)",
            }}
          >
            CONTEXT
            <br />
            LOADED
          </div>
        </div>

        {/* Subtext */}
        <div
          style={{
            fontSize: 18,
            color: "#e6edf3",
            opacity: loadedOpacity,
            fontWeight: 500,
          }}
        >
          /load-context
        </div>
      </div>
    </AbsoluteFill>
  );
};
