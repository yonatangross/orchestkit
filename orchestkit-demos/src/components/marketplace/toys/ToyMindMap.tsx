import React from "react";
import { AbsoluteFill, spring, interpolate } from "remotion";

/**
 * ToyMindMap - "PLAN" neon mind map with glowing lines
 * Thick neon lines with glow, sphere nodes, bungee overshoot
 */

const BOUNCE = { stiffness: 200, damping: 10 };

interface ToyMindMapProps {
  frame: number;
  fps: number;
}

const NODES = [
  { label: "API", color: "#a855f7", angle: -45, delay: 0 },
  { label: "DB", color: "#22c55e", angle: 45, delay: 2 },
  { label: "UI", color: "#06b6d4", angle: 135, delay: 4 },
  { label: "AUTH", color: "#f59e0b", angle: 225, delay: 6 },
];

export const ToyMindMap: React.FC<ToyMindMapProps> = ({ frame, fps }) => {
  const centerScale = spring({ frame, fps, config: { stiffness: 300, damping: 12 } });

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
        2. PLAN
      </div>

      {/* Mind map container */}
      <div style={{ position: "relative", width: 500, height: 500 }}>
        {/* Connection lines - thick neon with glow */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <defs>
            {NODES.map((_node, idx) => (
              <filter key={idx} id={`glow-${idx}`}>
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>
          {NODES.map((node, idx) => {
            const nodeFrame = Math.max(0, frame - node.delay);
            const lineProgress = spring({ frame: nodeFrame, fps, config: BOUNCE });
            const distance = 150;
            const rad = (node.angle * Math.PI) / 180;
            const endX = 250 + Math.cos(rad) * distance * lineProgress;
            const endY = 250 + Math.sin(rad) * distance * lineProgress;

            // Stroke dash for draw-on effect
            const lineLength = distance;
            const dashOffset = interpolate(lineProgress, [0, 1], [lineLength, 0]);

            return (
              <g key={idx}>
                {/* Glow line */}
                <line
                  x1={250}
                  y1={250}
                  x2={endX}
                  y2={endY}
                  stroke={node.color}
                  strokeWidth={8}
                  strokeLinecap="round"
                  opacity={lineProgress * 0.4}
                  filter={`url(#glow-${idx})`}
                />
                {/* Main line */}
                <line
                  x1={250}
                  y1={250}
                  x2={endX}
                  y2={endY}
                  stroke={node.color}
                  strokeWidth={4}
                  strokeLinecap="round"
                  opacity={lineProgress}
                  strokeDasharray={lineLength}
                  strokeDashoffset={dashOffset}
                />
              </g>
            );
          })}
        </svg>

        {/* Center node - GOAL with sphere gradient */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${centerScale})`,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #ffffff 0%, #d4d4d4 50%, #a0a0a0 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `
              0 10px 40px rgba(255,255,255,0.2),
              0 4px 12px rgba(0,0,0,0.4),
              inset 0 -3px 6px rgba(0,0,0,0.15)
            `,
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 800, color: "#050505" }}>GOAL</span>
        </div>

        {/* Outer nodes - sphere gradient + bungee overshoot */}
        {NODES.map((node, idx) => {
          const nodeFrame = Math.max(0, frame - node.delay);
          const nodeProgress = spring({ frame: nodeFrame, fps, config: BOUNCE });
          // Bungee: shoot past, spring back
          const overshoot = interpolate(nodeProgress, [0, 0.6, 0.8, 1], [0, 1.3, 0.9, 1]);
          const distance = 150;
          const rad = (node.angle * Math.PI) / 180;
          const x = Math.cos(rad) * distance * overshoot;
          const y = Math.sin(rad) * distance * overshoot;

          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${nodeProgress})`,
                width: 70,
                height: 70,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${node.color} 0%, ${node.color}cc 70%, ${node.color}88 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `
                  0 8px 30px ${node.color}60,
                  0 0 20px ${node.color}40,
                  inset 0 2px 4px rgba(255,255,255,0.3),
                  inset 0 -2px 4px rgba(0,0,0,0.2)
                `,
                opacity: nodeProgress,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
                {node.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Subtext */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          fontSize: 18,
          color: "#e6edf3",
          fontWeight: 500,
          opacity: interpolate(frame, [fps * 0.3, fps * 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        /brainstorming
      </div>
    </AbsoluteFill>
  );
};
