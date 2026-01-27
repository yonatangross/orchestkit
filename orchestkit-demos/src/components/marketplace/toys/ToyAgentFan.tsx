import React from "react";
import { AbsoluteFill, spring, interpolate } from "remotion";

/**
 * ToyAgentFan - "BUILD" poker hand fan with 3D tilt
 * Perspective tilt, gradient cards, 3-frame stagger, white edge borders
 */

interface ToyAgentFanProps {
  frame: number;
  fps: number;
}

const AGENTS = [
  { name: "Architect", icon: "🏗️", color: "#a855f7", colorEnd: "#7c3aed" },
  { name: "Frontend", icon: "⚛️", color: "#06b6d4", colorEnd: "#0891b2" },
  { name: "Backend", icon: "🔧", color: "#22c55e", colorEnd: "#16a34a" },
  { name: "Security", icon: "🛡️", color: "#ef4444", colorEnd: "#dc2626" },
  { name: "Testing", icon: "🧪", color: "#f59e0b", colorEnd: "#d97706" },
];

export const ToyAgentFan: React.FC<ToyAgentFanProps> = ({ frame, fps }) => {
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 45%, #1a1b26 0%, #050508 100%)",
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
        3. BUILD
      </div>

      {/* Card fan container with 3D perspective */}
      <div
        style={{
          position: "relative",
          width: 200,
          height: 280,
          perspective: 1000,
        }}
      >
        {AGENTS.map((agent, idx) => {
          // 3-frame stagger between cards
          const cardDelay = idx * 3;
          const cardFrame = Math.max(0, frame - cardDelay);
          const fanProgress = spring({
            frame: cardFrame,
            fps,
            config: { mass: 2, stiffness: 240, damping: 14 },
          });

          // Fan rotation with overshoot
          const targetRotation = (idx - 2) * 10;
          const rotation = interpolate(fanProgress, [0, 0.7, 1], [0, targetRotation * 1.2, targetRotation]);

          // Scale with overshoot
          const scale = interpolate(fanProgress, [0, 0.5, 1], [0.8, 1.15, 1.05]);

          // Translate outward
          const translateX = interpolate(fanProgress, [0, 1], [0, (idx - 2) * 15]);
          const translateY = interpolate(fanProgress, [0, 1], [idx * -2, -20]);

          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 200,
                height: 280,
                transformOrigin: "bottom center",
                transform: `
                  translateX(${translateX}px)
                  translateY(${translateY}px)
                  rotate(${rotation}deg)
                  rotateX(15deg)
                  scale(${scale})
                `,
                zIndex: idx,
              }}
            >
              {/* Card with gradient + white edge */}
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 16,
                  background: `linear-gradient(160deg, ${agent.color} 0%, ${agent.colorEnd} 100%)`,
                  border: "1px solid rgba(255,255,255,0.2)",
                  boxShadow: `
                    0 15px 40px rgba(0,0,0,0.5),
                    0 5px 15px rgba(0,0,0,0.3),
                    0 0 20px ${agent.color}30,
                    inset 0 1px 0 rgba(255,255,255,0.15)
                  `,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  padding: 20,
                }}
              >
                <span style={{ fontSize: 48, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
                  {agent.icon}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#ffffff",
                    letterSpacing: 1,
                    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }}
                >
                  {agent.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtext */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          fontSize: 18,
          color: "#e6edf3",
          fontWeight: 500,
          opacity: interpolate(frame, [fps * 0.3, fps * 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        /implement
      </div>
    </AbsoluteFill>
  );
};
