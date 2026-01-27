import React from "react";
import { AbsoluteFill, spring, interpolate } from "remotion";

/**
 * ToyChecklist - "REVIEW" document with stamps
 * PR document card with 3 green checkmarks stamping down
 * Studio spotlight background, glass-morphism card
 */

const SNAP = { stiffness: 400, damping: 20 };

interface ToyChecklistProps {
  frame: number;
  fps: number;
}

const CHECKS = [
  { label: "Code Quality", frame: 6, rotation: -8 },
  { label: "Test Coverage", frame: 15, rotation: 5 },
  { label: "Security Audit", frame: 24, rotation: -3 },
];

export const ToyChecklist: React.FC<ToyChecklistProps> = ({ frame, fps }) => {
  // Card entry animation
  const cardEntry = spring({ frame, fps, config: { stiffness: 200, damping: 15 } });

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
        7. REVIEW
      </div>

      {/* Document card */}
      <div
        style={{
          transform: `scale(${cardEntry})`,
          width: 400,
          backgroundColor: "rgba(22, 27, 34, 0.85)",
          borderRadius: 16,
          border: "1px solid rgba(48, 54, 61, 0.8)",
          overflow: "hidden",
          boxShadow: `
            0 20px 60px rgba(0,0,0,0.5),
            0 0 40px rgba(168, 85, 247, 0.1),
            inset 0 1px 0 rgba(255,255,255,0.05)
          `,
        }}
      >
        {/* PR Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #30363d",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              backgroundColor: "#a855f7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            ⎇
          </div>
          <div>
            <div style={{ color: "#e6edf3", fontSize: 16, fontWeight: 600 }}>
              Pull Request #127
            </div>
            <div style={{ color: "#8b949e", fontSize: 13 }}>
              feat: add authentication service
            </div>
          </div>
        </div>

        {/* Checklist items */}
        <div style={{ padding: 24 }}>
          {CHECKS.map((check, idx) => {
            const checkFrame = Math.max(0, frame - check.frame);
            const stampProgress = spring({ frame: checkFrame, fps, config: SNAP });

            // Stamp slams down from above
            const stampY = interpolate(stampProgress, [0, 0.5, 1], [-50, 5, 0]);
            const stampScale = interpolate(stampProgress, [0, 0.5, 1], [1.5, 1.1, 1]);
            const stampOpacity = interpolate(stampProgress, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 0",
                  borderBottom: idx < CHECKS.length - 1 ? "1px solid #30363d" : "none",
                }}
              >
                <span style={{ color: "#e6edf3", fontSize: 16 }}>{check.label}</span>

                {/* Stamp checkmark */}
                <div
                  style={{
                    transform: `
                      translateY(${stampY}px)
                      scale(${stampScale})
                      rotate(${check.rotation}deg)
                    `,
                    opacity: stampOpacity,
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: "#22c55e",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: stampProgress > 0.5 ? "0 4px 15px rgba(34, 197, 94, 0.4)" : "none",
                  }}
                >
                  <span style={{ color: "#ffffff", fontSize: 24, fontWeight: 900 }}>✓</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer status */}
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "#0d1117",
            borderTop: "1px solid #30363d",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "#8b949e", fontSize: 14 }}>6 agents reviewed</span>
          <div
            style={{
              opacity: frame > CHECKS[2].frame + 10 ? 1 : 0,
              backgroundColor: "#22c55e",
              color: "#ffffff",
              padding: "6px 16px",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Ready to merge
          </div>
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
          opacity: frame > CHECKS[2].frame + 10 ? 1 : 0,
        }}
      >
        /review-pr
      </div>
    </AbsoluteFill>
  );
};
