/** Spinning agent indicator that transitions to a checkmark on completion */

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { SPINNER_CHARS, MONO, DIM, GREEN } from "./constants";

interface AgentSpinnerProps {
  name: string;
  color: string;
  statusText: string;
  completedText: string;
  completionFrame: number;
  raceStartFrame: number;
}

export const AgentSpinner: React.FC<AgentSpinnerProps> = ({
  name,
  color,
  statusText,
  completedText,
  completionFrame,
  raceStartFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const raceElapsed = frame - raceStartFrame;
  const isComplete = raceElapsed >= completionFrame;

  const spinnerIdx = Math.floor(frame / 3) % SPINNER_CHARS.length;

  const checkScale = isComplete
    ? spring({
        frame: raceElapsed - completionFrame,
        fps,
        config: { damping: 12, stiffness: 200 },
      })
    : 0;

  const lineOpacity = interpolate(raceElapsed, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: MONO,
        fontSize: 18,
        lineHeight: 1.8,
        opacity: lineOpacity,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: 22,
          justifyContent: "center",
          color: isComplete ? GREEN : color,
          transform: isComplete ? `scale(${checkScale})` : undefined,
          fontWeight: 700,
        }}
      >
        {isComplete ? "✓" : SPINNER_CHARS[spinnerIdx]}
      </span>
      <span style={{ color, fontWeight: 600, minWidth: 240 }}>{name}</span>
      <span style={{ color: isComplete ? GREEN : DIM }}>
        {isComplete ? completedText : statusText}
      </span>
    </div>
  );
};
