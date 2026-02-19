/** Results block with colored findings grid (no ASCII tables) */

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { MONO, DIM, GREEN } from "./constants";

/** A single finding row: label, value, and optional severity color */
interface Finding {
  label: string;
  value: string;
  severity: "pass" | "warn" | "fail";
}

/** An advisory line shown at the bottom */
interface Advisory {
  text: string;
}

interface ResultsBlockProps {
  resultTitle: string;
  score: string;
  findings: Finding[];
  advisories: Advisory[];
  startFrame: number;
  primaryColor: string;
}

const SEVERITY_COLORS: Record<Finding["severity"], string> = {
  pass: GREEN,
  warn: "#f59e0b",
  fail: "#ef4444",
};

export const ResultsBlock: React.FC<ResultsBlockProps> = ({
  resultTitle,
  score,
  findings,
  advisories,
  startFrame,
  primaryColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = Math.max(0, frame - startFrame);

  const titleOpacity = interpolate(elapsed, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scoreScale = spring({
    frame: Math.max(0, elapsed - 10),
    fps,
    config: { damping: 10, stiffness: 150 },
  });

  return (
    <div style={{ fontFamily: MONO, fontSize: 16 }}>
      {/* Separator */}
      <div
        style={{
          height: 2,
          background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}44)`,
          opacity: titleOpacity,
          marginBottom: 12,
        }}
      />

      {/* Title + Score row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          opacity: titleOpacity,
          marginBottom: 14,
        }}
      >
        <span style={{ color: GREEN, fontWeight: 700, fontSize: 20 }}>
          {resultTitle}
        </span>
        <span
          style={{
            color: "#f0c000",
            fontWeight: 700,
            fontSize: 22,
            transform: `scale(${scoreScale})`,
            display: "inline-block",
          }}
        >
          {score}
        </span>
      </div>

      {/* Findings grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {findings.map((f, i) => {
          const delay = 16 + i * 5;
          const opacity = interpolate(elapsed, [delay, delay + 8], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity,
              }}
            >
              <span
                style={{
                  color: SEVERITY_COLORS[f.severity],
                  width: 16,
                  fontWeight: 700,
                }}
              >
                {f.severity === "pass" ? "✓" : f.severity === "warn" ? "!" : "✗"}
              </span>
              <span style={{ color: DIM, width: 140 }}>{f.label}</span>
              <span style={{ color: SEVERITY_COLORS[f.severity] }}>
                {f.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Advisories */}
      {advisories.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 8 }}>
          {advisories.map((a, i) => {
            const delay = 16 + findings.length * 5 + 8 + i * 6;
            const opacity = interpolate(elapsed, [delay, delay + 8], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            });
            return (
              <div
                key={i}
                style={{
                  color: "#f59e0b",
                  fontSize: 14,
                  lineHeight: 1.7,
                  opacity,
                }}
              >
                <span style={{ marginRight: 8 }}>▸</span>
                {a.text}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
