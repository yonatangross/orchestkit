/** Single terminal line with typewriter cursor effect */

import React from "react";
import { useCurrentFrame } from "remotion";
import { MONO, FG } from "./constants";

interface TypewriterLineProps {
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  color?: string;
  prefix?: React.ReactNode;
}

export const TypewriterLine: React.FC<TypewriterLineProps> = ({
  text,
  startFrame,
  charsPerFrame = 0.8,
  color = FG,
  prefix,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charsToShow = Math.min(text.length, Math.floor(elapsed * charsPerFrame));
  const cursorVisible = frame % 16 < 8;
  const done = charsToShow >= text.length;

  if (elapsed < 0) return null;

  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 20,
        lineHeight: 1.6,
        color,
        whiteSpace: "pre",
      }}
    >
      {prefix}
      {text.slice(0, charsToShow)}
      {!done && (
        <span style={{ opacity: cursorVisible ? 1 : 0, color: "#58a6ff" }}>
          █
        </span>
      )}
    </div>
  );
};
