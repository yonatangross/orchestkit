// src/components/shared/AvatarPlaceholder.tsx
// Placeholder component displayed while HeyGen video is generating

import React from "react";
import { useCurrentFrame, interpolate, Img } from "remotion";

interface AvatarPlaceholderProps {
  avatarName?: string;
  previewImageUrl?: string;
  message?: string;
  size?: "small" | "medium" | "large";
}

const SIZE_CONFIGS = {
  small: { avatar: 120, fontSize: 16, messageSize: 12 },
  medium: { avatar: 200, fontSize: 24, messageSize: 16 },
  large: { avatar: 300, fontSize: 32, messageSize: 20 },
};

export const AvatarPlaceholder: React.FC<AvatarPlaceholderProps> = ({
  avatarName = "AI Avatar",
  previewImageUrl,
  message = "Avatar video generating...",
  size = "medium",
}) => {
  const frame = useCurrentFrame();
  const config = SIZE_CONFIGS[size];

  // Pulsing animation
  const pulse = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.95, 1.05]);

  // Rotating gradient
  const rotation = (frame * 2) % 360;

  // Loading dots animation
  const dots = ".".repeat((Math.floor(frame / 20) % 4));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0f",
      }}
    >
      {/* Animated ring behind avatar */}
      <div
        style={{
          position: "relative",
          width: config.avatar + 20,
          height: config.avatar + 20,
        }}
      >
        {/* Rotating gradient ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `conic-gradient(from ${rotation}deg, #8b5cf6, #06b6d4, #8b5cf6)`,
            opacity: 0.8,
          }}
        />

        {/* Avatar container */}
        <div
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: "50%",
            backgroundColor: "#1a1a2e",
            overflow: "hidden",
            transform: `scale(${pulse})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {previewImageUrl ? (
            <Img
              src={previewImageUrl}
              alt={avatarName}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span
              style={{
                fontSize: config.avatar * 0.4,
                filter: "grayscale(0.5)",
              }}
            >
              👤
            </span>
          )}
        </div>
      </div>

      {/* Avatar name */}
      <h3
        style={{
          color: "white",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: config.fontSize,
          fontWeight: 600,
          marginTop: 24,
          marginBottom: 8,
        }}
      >
        {avatarName}
      </h3>

      {/* Loading message */}
      <p
        style={{
          color: "#8b5cf6",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: config.messageSize,
          fontWeight: 400,
          margin: 0,
        }}
      >
        {message}
        {dots}
      </p>

      {/* Subtle hint */}
      <p
        style={{
          color: "#666",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: config.messageSize * 0.75,
          marginTop: 16,
        }}
      >
        Run: npm run heygen:generate
      </p>
    </div>
  );
};

export default AvatarPlaceholder;
