import React from "react";
import { AbsoluteFill, spring, interpolate } from "remotion";

/**
 * ToyTrophy - "QUALITY" gold badge with spinning animation and counter
 * Badge spins 360° on Y-axis, counter rolls 0→100, shine sweep effect
 * Studio spotlight background, heavy spring, metallic gold gradient
 */

const HEAVY = { stiffness: 150, damping: 15, mass: 1.2 };

interface ToyTrophyProps {
  frame: number;
  fps: number;
}

export const ToyTrophy: React.FC<ToyTrophyProps> = ({ frame, fps }) => {
  // Entry spin - 360° on Y-axis
  const spinProgress = spring({ frame, fps, config: HEAVY });
  const rotationY = interpolate(spinProgress, [0, 1], [180, 0]);

  // Counter animation - 0 to 100 in ~1.5 seconds
  const counterValue = Math.min(100, Math.floor(interpolate(frame, [fps * 0.5, fps * 2], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));

  // Shine sweep - diagonal gradient moving across
  const shinePosition = interpolate(frame, [fps * 0.3, fps * 1.5], [-100, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Scale bounce when counter hits 100
  const completionFrame = frame > fps * 2 ? frame - fps * 2 : 0;
  const completionBounce = spring({ frame: completionFrame, fps, config: { stiffness: 300, damping: 10 } });
  const bounceScale = interpolate(completionBounce, [0, 0.5, 1], [1, 1.15, 1]);

  // Badge glow intensity based on counter
  const glowIntensity = counterValue / 100;

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 45%, #1a1b26 0%, #0d0d14 50%, #050508 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >

      {/* Label */}
      <div
        style={{
          position: "absolute",
          top: 120,
          fontSize: 24,
          fontWeight: 700,
          color: "#8b949e",
          letterSpacing: 4,
        }}
      >
        6. QUALITY
      </div>

      {/* Trophy container */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Badge with spin */}
        <div
          style={{
            perspective: 800,
          }}
        >
          <div
            style={{
              transform: `rotateY(${rotationY}deg) scale(${bounceScale})`,
              transformStyle: "preserve-3d",
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `
                0 10px 40px rgba(245, 158, 11, ${glowIntensity * 0.5}),
                0 0 60px rgba(245, 158, 11, ${glowIntensity * 0.3}),
                inset 0 2px 10px rgba(255,255,255,0.3)
              `,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Star icon */}
            <span
              style={{
                fontSize: 72,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
              }}
            >
              ⭐
            </span>

            {/* Shine sweep effect */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: shinePosition,
                width: 60,
                height: "200%",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                transform: "rotate(25deg)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Counter */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: counterValue >= 100 ? "#22c55e" : "#f59e0b",
              fontFamily: "SF Mono, monospace",
              textShadow: counterValue >= 100 ? "0 0 20px rgba(34, 197, 94, 0.5)" : "none",
            }}
          >
            {counterValue}
          </span>
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#8b949e",
            }}
          >
            %
          </span>
        </div>

        {/* Quality label */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: counterValue >= 100 ? "#22c55e" : "#8b949e",
            letterSpacing: 2,
            opacity: spinProgress,
          }}
        >
          {counterValue >= 100 ? "GRADE A - SHIP IT!" : "ANALYZING..."}
        </div>
      </div>

      {/* Subtext */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          fontSize: 18,
          color: "#e6edf3",
          fontWeight: 500,
          opacity: counterValue >= 100 ? 1 : 0,
        }}
      >
        /verify --quality
      </div>
    </AbsoluteFill>
  );
};
