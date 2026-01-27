import React from "react";
import { interpolate } from "remotion";
import { ORCHESTKIT_STATS } from "../../constants";

/**
 * InfiniteMarquee - 3-row scrolling plugin wall
 * Row 1 & 3 scroll left, Row 2 scrolls right
 * 3D perspective tilt, zoom from 2.0→0.8 to reveal massive plugin grid
 * Studio spotlight background
 */

interface InfiniteMarqueeProps {
  frame: number;
  fps: number;
}

// Plugin data organized by rows
const PLUGINS_ROW1 = [
  { name: "ork-core", icon: "🎯", color: "#a855f7" },
  { name: "ork-security", icon: "🔒", color: "#ef4444" },
  { name: "ork-llm-core", icon: "🤖", color: "#06b6d4" },
  { name: "ork-git", icon: "🔀", color: "#f59e0b" },
  { name: "ork-database", icon: "🗄️", color: "#22c55e" },
  { name: "ork-rag", icon: "📚", color: "#ec4899" },
  { name: "ork-testing", icon: "🧪", color: "#8b5cf6" },
  { name: "ork-frontend", icon: "⚛️", color: "#06b6d4" },
];

const PLUGINS_ROW2 = [
  { name: "ork-backend", icon: "🏗️", color: "#22c55e" },
  { name: "ork-mcp", icon: "🔌", color: "#a855f7" },
  { name: "ork-memory", icon: "🧠", color: "#ec4899" },
  { name: "ork-cicd", icon: "🚀", color: "#f59e0b" },
  { name: "ork-infra", icon: "☁️", color: "#06b6d4" },
  { name: "ork-graphql", icon: "◈", color: "#e91e63" },
  { name: "ork-async", icon: "⚡", color: "#ffc107" },
  { name: "ork-observability", icon: "📊", color: "#4caf50" },
];

const PLUGINS_ROW3 = [
  { name: "ork-auth", icon: "🔐", color: "#ef4444" },
  { name: "ork-langgraph", icon: "🔗", color: "#9c27b0" },
  { name: "ork-caching", icon: "💾", color: "#00bcd4" },
  { name: "ork-validation", icon: "✅", color: "#4caf50" },
  { name: "ork-docs", icon: "📝", color: "#ff9800" },
  { name: "ork-a11y", icon: "♿", color: "#2196f3" },
  { name: "ork-i18n", icon: "🌐", color: "#673ab7" },
  { name: "ork-perf", icon: "⏱️", color: "#ff5722" },
];

const MarqueeRow: React.FC<{
  plugins: typeof PLUGINS_ROW1;
  direction: "left" | "right";
  speed: number;
  frame: number;
}> = ({ plugins, direction, speed, frame }) => {
  // Triple the plugins for seamless loop
  const tripled = [...plugins, ...plugins, ...plugins];

  // Calculate scroll position
  const totalWidth = plugins.length * 200; // Approximate width per badge
  let scrollX = (frame * speed) % totalWidth;
  if (direction === "right") scrollX = -scrollX;

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        transform: `translateX(${-scrollX}px)`,
        willChange: "transform",
      }}
    >
      {tripled.map((plugin, idx) => (
        <div
          key={idx}
          style={{
            flex: "0 0 auto",
            backgroundColor: "rgba(22, 27, 34, 0.85)",
            borderRadius: 12,
            border: `1px solid ${plugin.color}40`,
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 180,
            boxShadow: `
              0 4px 20px ${plugin.color}20,
              inset 0 1px 0 rgba(255,255,255,0.05)
            `,
          }}
        >
          <span style={{ fontSize: 28 }}>{plugin.icon}</span>
          <span style={{ color: "#e6edf3", fontSize: 15, fontWeight: 600 }}>
            {plugin.name}
          </span>
        </div>
      ))}
    </div>
  );
};

export const InfiniteMarquee: React.FC<InfiniteMarqueeProps> = ({ frame, fps }) => {
  // Dramatic zoom out: 2.0 → 0.8 over first 2.5 seconds
  const zoomProgress = interpolate(frame, [0, fps * 2.5], [2.0, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3D perspective tilt
  const tiltX = interpolate(frame, [0, fps * 2], [15, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Stats fade in
  const statsOpacity = interpolate(frame, [fps * 0.5, fps * 1.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "radial-gradient(ellipse at 50% 40%, #1a1b26 0%, #0d0d14 50%, #050508 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        perspective: 1200,
      }}
    >
      {/* Stats header */}
      <div
        style={{
          display: "flex",
          gap: 80,
          marginBottom: 40,
          opacity: statsOpacity,
          transform: `scale(${interpolate(statsOpacity, [0, 1], [0.9, 1])})`,
        }}
      >
        {[
          { value: ORCHESTKIT_STATS.skills, label: "SKILLS", color: "#a855f7" },
          { value: ORCHESTKIT_STATS.agents, label: "AGENTS", color: "#06b6d4" },
          { value: ORCHESTKIT_STATS.hooks, label: "HOOKS", color: "#22c55e" },
        ].map((stat, idx) => (
          <div key={idx} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 64,
                fontWeight: 900,
                color: stat.color,
                fontFamily: "SF Mono, monospace",
                textShadow: `0 0 40px ${stat.color}60`,
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#8b949e",
                letterSpacing: 3,
                marginTop: 8,
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Marquee container with zoom */}
      <div
        style={{
          width: "120vw",
          transform: `scale(${zoomProgress}) rotateX(${tiltX}deg)`,
          transformStyle: "preserve-3d",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Row 1 - Left */}
        <div style={{ overflow: "hidden" }}>
          <MarqueeRow plugins={PLUGINS_ROW1} direction="left" speed={1.5} frame={frame} />
        </div>

        {/* Row 2 - Right */}
        <div style={{ overflow: "hidden" }}>
          <MarqueeRow plugins={PLUGINS_ROW2} direction="right" speed={1.2} frame={frame} />
        </div>

        {/* Row 3 - Left (faster) */}
        <div style={{ overflow: "hidden" }}>
          <MarqueeRow plugins={PLUGINS_ROW3} direction="left" speed={1.8} frame={frame} />
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          marginTop: 40,
          fontSize: 20,
          color: "#8b949e",
          opacity: interpolate(frame, [fps * 2, fps * 3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Pick your stack. Mix and match.
      </div>
    </div>
  );
};
