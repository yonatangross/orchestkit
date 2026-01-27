import React from "react";
import { AbsoluteFill, spring } from "remotion";

/**
 * ToyNetwork - "LEARN" knowledge graph constellation
 * Nodes connect with animated lines, pulsing brightness on connection
 * Studio spotlight background, sphere gradient nodes
 */

const BOUNCE = { stiffness: 200, damping: 10 };

interface ToyNetworkProps {
  frame: number;
  fps: number;
}

// Node positions (relative to center)
const NODES = [
  { id: "center", x: 0, y: 0, label: "CORE", color: "#a855f7", size: 60 },
  { id: "api", x: -120, y: -80, label: "API", color: "#06b6d4", size: 40 },
  { id: "auth", x: 120, y: -60, label: "AUTH", color: "#22c55e", size: 40 },
  { id: "db", x: -80, y: 100, label: "DB", color: "#f59e0b", size: 40 },
  { id: "cache", x: 100, y: 80, label: "CACHE", color: "#ec4899", size: 40 },
  { id: "queue", x: 0, y: -130, label: "QUEUE", color: "#ef4444", size: 35 },
];

// Connections between nodes with timing
const CONNECTIONS = [
  { from: "center", to: "api", delay: 0 },
  { from: "center", to: "auth", delay: 5 },
  { from: "center", to: "db", delay: 10 },
  { from: "center", to: "cache", delay: 15 },
  { from: "center", to: "queue", delay: 20 },
  { from: "api", to: "auth", delay: 25 },
  { from: "db", to: "cache", delay: 30 },
  { from: "auth", to: "queue", delay: 35 },
];

export const ToyNetwork: React.FC<ToyNetworkProps> = ({ frame, fps }) => {
  const getNode = (id: string) => NODES.find((n) => n.id === id)!;

  // Calculate active connections for pulse effect
  const activeConnections = CONNECTIONS.filter((c) => frame >= c.delay).length;
  const pulseIntensity = 0.3 + (activeConnections / CONNECTIONS.length) * 0.7;

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
        8. LEARN
      </div>

      {/* Network container */}
      <div
        style={{
          position: "relative",
          width: 400,
          height: 400,
        }}
      >
        {/* SVG for connections */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          {CONNECTIONS.map((conn, idx) => {
            const connFrame = Math.max(0, frame - conn.delay);
            const lineProgress = spring({ frame: connFrame, fps, config: BOUNCE });

            const fromNode = getNode(conn.from);
            const toNode = getNode(conn.to);

            // Line coordinates (centered in container)
            const x1 = 200 + fromNode.x;
            const y1 = 200 + fromNode.y;
            const x2 = 200 + toNode.x;
            const y2 = 200 + toNode.y;

            // Animated end point
            const currentX2 = x1 + (x2 - x1) * lineProgress;
            const currentY2 = y1 + (y2 - y1) * lineProgress;

            return (
              <g key={idx}>
                {/* Glow line */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={currentX2}
                  y2={currentY2}
                  stroke={`rgba(168, 85, 247, ${lineProgress * 0.5})`}
                  strokeWidth={6}
                  strokeLinecap="round"
                  filter="blur(3px)"
                />
                {/* Main line */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={currentX2}
                  y2={currentY2}
                  stroke="rgba(168, 85, 247, 0.8)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  opacity={lineProgress}
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {NODES.map((node, idx) => {
          const nodeDelay = idx * 3;
          const nodeFrame = Math.max(0, frame - nodeDelay);
          const nodeProgress = spring({ frame: nodeFrame, fps, config: BOUNCE });

          // Calculate brightness based on connections
          const nodeConnections = CONNECTIONS.filter(
            (c) => (c.from === node.id || c.to === node.id) && frame >= c.delay + 10
          ).length;
          const brightness = 1 + nodeConnections * 0.15;

          return (
            <div
              key={node.id}
              style={{
                position: "absolute",
                left: 200 + node.x - node.size / 2,
                top: 200 + node.y - node.size / 2,
                width: node.size,
                height: node.size,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${node.color} 0%, ${node.color}cc 70%, ${node.color}88 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${nodeProgress})`,
                opacity: nodeProgress,
                boxShadow: `
                  0 0 ${20 * brightness}px ${node.color}${Math.round(brightness * 40).toString(16).padStart(2, "0")},
                  0 0 ${40 * brightness}px ${node.color}${Math.round(brightness * 20).toString(16).padStart(2, "0")},
                  inset 0 2px 4px rgba(255,255,255,0.3),
                  inset 0 -2px 4px rgba(0,0,0,0.2)
                `,
                filter: `brightness(${brightness})`,
              }}
            >
              <span
                style={{
                  fontSize: node.size * 0.3,
                  fontWeight: 700,
                  color: "#ffffff",
                  textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                }}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div
        style={{
          position: "absolute",
          bottom: 140,
          display: "flex",
          gap: 40,
          opacity: pulseIntensity,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#a855f7" }}>
            {activeConnections}
          </div>
          <div style={{ fontSize: 12, color: "#8b949e", letterSpacing: 1 }}>CONNECTIONS</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#22c55e" }}>
            {NODES.length}
          </div>
          <div style={{ fontSize: 12, color: "#8b949e", letterSpacing: 1 }}>CONCEPTS</div>
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
          opacity: activeConnections >= CONNECTIONS.length * 0.8 ? 1 : 0,
        }}
      >
        /remember
      </div>
    </AbsoluteFill>
  );
};
