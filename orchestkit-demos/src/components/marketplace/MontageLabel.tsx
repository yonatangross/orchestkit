import React from "react";
import { spring, interpolate } from "remotion";

/**
 * MontageLabel - Step counter overlay with glitch effect on text change
 * Shows current step name: "1. CONTEXT", "2. PLAN", etc.
 */

interface MontageLabelProps {
  frame: number;
  fps: number;
  currentStep: number;
  stepName: string;
  totalSteps?: number;
}

export const MontageLabel: React.FC<MontageLabelProps> = ({
  frame,
  fps,
  currentStep,
  stepName,
  totalSteps = 8,
}) => {
  // Entry animation
  const entryProgress = spring({
    frame,
    fps,
    config: { stiffness: 200, damping: 15 },
  });

  // Glitch effect - random offset on text change
  const glitchFrame = frame % (fps * 0.1); // Glitch every ~3 frames
  const glitchX = glitchFrame < 2 ? Math.random() * 4 - 2 : 0;
  const glitchY = glitchFrame < 2 ? Math.random() * 2 - 1 : 0;

  // Progress bar
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: 40,
        right: 40,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: entryProgress,
        transform: `translateY(${interpolate(entryProgress, [0, 1], [20, 0])}px)`,
      }}
    >
      {/* Step label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Step number badge */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: "#a855f7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 900,
            color: "#ffffff",
            boxShadow: "0 4px 20px rgba(168, 85, 247, 0.4)",
          }}
        >
          {currentStep}
        </div>

        {/* Step name with glitch */}
        <div
          style={{
            position: "relative",
          }}
        >
          {/* Glitch shadow layers */}
          <span
            style={{
              position: "absolute",
              fontSize: 24,
              fontWeight: 700,
              color: "#06b6d4",
              opacity: 0.5,
              transform: `translate(${glitchX}px, ${glitchY}px)`,
              mixBlendMode: "screen",
            }}
          >
            {stepName}
          </span>
          <span
            style={{
              position: "absolute",
              fontSize: 24,
              fontWeight: 700,
              color: "#ec4899",
              opacity: 0.5,
              transform: `translate(${-glitchX}px, ${-glitchY}px)`,
              mixBlendMode: "screen",
            }}
          >
            {stepName}
          </span>
          {/* Main text */}
          <span
            style={{
              position: "relative",
              fontSize: 24,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: 2,
            }}
          >
            {stepName}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, #a855f7, #ec4899, #f59e0b)",
            borderRadius: 2,
            transition: "width 0.3s ease-out",
          }}
        />
      </div>

      {/* Step counter */}
      <div
        style={{
          fontSize: 12,
          color: "#8b949e",
          letterSpacing: 1,
        }}
      >
        {currentStep} / {totalSteps}
      </div>
    </div>
  );
};
