import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

interface GlowButtonProps {
  text: string;
  primaryColor?: string;
  secondaryColor?: string;
  delay?: number;
  pulse?: boolean;
  fontSize?: number;
}

export const GlowButton: React.FC<GlowButtonProps> = ({
  text,
  primaryColor = "#8b5cf6",
  secondaryColor = "#6366f1",
  delay = 0,
  pulse = true,
  fontSize = 26,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Subtle pulse animation
  const pulseScale = pulse ? 1 + Math.sin(frame * 0.15) * 0.02 : 1;

  // Glow intensity pulsing
  const glowIntensity = pulse
    ? 10 + Math.sin(frame * 0.1) * 5
    : 10;

  return (
    <div
      style={{
        opacity,
        transform: `scale(${Math.min(1, scale) * pulseScale})`,
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`,
          borderRadius: 12,
          padding: "14px 28px",
          boxShadow: `0 ${glowIntensity}px ${glowIntensity * 4}px ${primaryColor}50`,
          cursor: "pointer",
        }}
      >
        <code
          style={{
            fontSize,
            color: "white",
            fontFamily: "Menlo, monospace",
            fontWeight: 600,
          }}
        >
          {text}
        </code>
      </div>
    </div>
  );
};

interface IconButtonProps {
  icon: string;
  label?: string;
  color?: string;
  delay?: number;
  size?: number;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  color = "#8b5cf6",
  delay = 0,
  size = 48,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: `${color}20`,
          border: `2px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.5,
        }}
      >
        {icon}
      </div>
      {label && (
        <span
          style={{
            fontSize: 12,
            color: "#9ca3af",
            fontFamily: "Menlo, monospace",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
