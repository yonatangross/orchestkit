import React from "react";
import { spring, interpolate } from "remotion";

/**
 * Camera - Wrapper component with beat recoil effect
 * Triggers a subtle scale pulse on every beat (15 frames at 30fps = 120 BPM)
 */

interface CameraProps {
  children: React.ReactNode;
  frame: number;
  fps: number;
  beatInterval?: number; // Frames between beats (default: 15 = 120 BPM)
}

export const Camera: React.FC<CameraProps> = ({
  children,
  frame,
  fps,
  beatInterval = 15,
}) => {
  // Calculate frame position within current beat
  const frameInBeat = frame % beatInterval;

  // Recoil effect on each beat
  const recoilProgress = spring({
    frame: frameInBeat,
    fps,
    config: { stiffness: 400, damping: 15 },
  });

  // Scale: 1.02 → 1.0 on each beat
  const scale = interpolate(recoilProgress, [0, 0.3, 1], [1.015, 1.0, 1.0]);

  // Subtle rotation wobble
  const rotation = interpolate(
    recoilProgress,
    [0, 0.2, 0.5, 1],
    [0.2, -0.1, 0.05, 0]
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
};
