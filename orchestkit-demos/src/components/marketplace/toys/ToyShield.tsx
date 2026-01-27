import React from "react";
import { AbsoluteFill, spring, interpolate } from "remotion";

/**
 * ToyShield - "SECURITY" metal slab shield
 * Heavy slam (scale 3→1), metallic gradient, screen shake, red→green flip
 */

interface ToyShieldProps {
  frame: number;
  fps: number;
}

export const ToyShield: React.FC<ToyShieldProps> = ({ frame, fps }) => {
  // Heavy shield slam
  const slamProgress = spring({
    frame,
    fps,
    config: { mass: 3, stiffness: 200, damping: 20 },
  });
  const shieldScale = interpolate(slamProgress, [0, 0.4, 0.7, 1], [3.0, 0.85, 1.05, 1]);
  const shieldOpacity = interpolate(slamProgress, [0, 0.15], [0, 1], { extrapolateRight: "clamp" });

  // Screen shake on impact
  const impactFrame = Math.max(0, frame - 4);
  const shakeProgress = spring({ frame: impactFrame, fps, config: { stiffness: 500, damping: 10 } });
  const shakeY = interpolate(shakeProgress, [0, 0.2, 0.5, 0.8, 1], [0, -12, 8, -4, 0]);

  // Color flip: red → green
  const colorFlipFrame = Math.max(0, frame - 15);
  const colorProgress = spring({ frame: colorFlipFrame, fps, config: { stiffness: 400, damping: 20 } });

  // Shield colors - metallic with gradient
  const redPhase = interpolate(colorProgress, [0, 1], [1, 0]);
  const greenPhase = interpolate(colorProgress, [0, 1], [0, 1]);

  // Checkmark
  const checkOpacity = interpolate(colorProgress, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" });
  const checkScale = spring({ frame: Math.max(0, frame - 18), fps, config: { stiffness: 300, damping: 12 } });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at 50% 45%, #1a1b26 0%, #050508 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${shakeY}px)`,
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
        5. SECURITY
      </div>

      {/* Shield */}
      <div
        style={{
          transform: `scale(${shieldScale})`,
          opacity: shieldOpacity,
          position: "relative",
        }}
      >
        <svg width="200" height="240" viewBox="0 0 200 240">
          <defs>
            {/* Metallic red gradient */}
            <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
              <stop
                offset="0%"
                stopColor={`rgb(${Math.round(200 * redPhase + 40 * greenPhase)}, ${Math.round(60 * redPhase + 180 * greenPhase)}, ${Math.round(60 * redPhase + 80 * greenPhase)})`}
              />
              <stop
                offset="50%"
                stopColor={`rgb(${Math.round(160 * redPhase + 25 * greenPhase)}, ${Math.round(40 * redPhase + 140 * greenPhase)}, ${Math.round(40 * redPhase + 65 * greenPhase)})`}
              />
              <stop
                offset="100%"
                stopColor={`rgb(${Math.round(120 * redPhase + 15 * greenPhase)}, ${Math.round(30 * redPhase + 100 * greenPhase)}, ${Math.round(30 * redPhase + 50 * greenPhase)})`}
              />
            </linearGradient>
            {/* Metallic sheen */}
            <linearGradient id="sheen" x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="40%" stopColor="rgba(255,255,255,0)" />
              <stop offset="60%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          {/* Shield body */}
          <path
            d="M100 10 L180 50 L180 120 C180 180 100 230 100 230 C100 230 20 180 20 120 L20 50 Z"
            fill="url(#shieldGrad)"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="3"
          />
          {/* Metallic sheen overlay */}
          <path
            d="M100 10 L180 50 L180 120 C180 180 100 230 100 230 C100 230 20 180 20 120 L20 50 Z"
            fill="url(#sheen)"
          />
          {/* Inner detail */}
          <path
            d="M100 30 L160 60 L160 115 C160 165 100 205 100 205 C100 205 40 165 40 115 L40 60 Z"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="2"
          />
          {/* 3D extrusion shadows */}
          <path
            d="M100 10 L180 50 L180 120 C180 180 100 230 100 230 C100 230 20 180 20 120 L20 50 Z"
            fill="none"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="6"
            transform="translate(0, 4)"
            opacity="0.3"
          />
        </svg>

        {/* Drop shadow glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            filter: `drop-shadow(0 10px 30px rgba(${Math.round(239 * redPhase + 34 * greenPhase)}, ${Math.round(68 * redPhase + 197 * greenPhase)}, ${Math.round(68 * redPhase + 94 * greenPhase)}, 0.5))`,
          }}
        />

        {/* Checkmark overlay */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -60%) scale(${checkScale})`,
            opacity: checkOpacity,
            fontSize: 64,
            fontWeight: 900,
            color: "#ffffff",
            textShadow: "0 2px 10px rgba(0,0,0,0.5), 0 0 20px rgba(34,197,94,0.5)",
          }}
        >
          ✓
        </div>
      </div>

      {/* Status text */}
      <div
        style={{
          position: "absolute",
          bottom: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: colorProgress > 0.5 ? "#22c55e" : "#ef4444",
            opacity: slamProgress,
            letterSpacing: 2,
            textShadow: colorProgress > 0.5 ? "0 0 10px rgba(34,197,94,0.5)" : "none",
          }}
        >
          {colorProgress > 0.5 ? "SECURE" : "SCANNING..."}
        </div>
        <div style={{ fontSize: 16, color: "#e6edf3", opacity: checkOpacity }}>
          /verify --security
        </div>
      </div>
    </AbsoluteFill>
  );
};
