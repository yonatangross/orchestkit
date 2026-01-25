// src/components/shared/AvatarVideo.tsx
// Reusable HeyGen avatar video component with positioning presets

import React from "react";
import { OffthreadVideo } from "remotion";

export type AvatarPosition =
  | "fullscreen"
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "pip-small"
  | "pip-medium"
  | "left-third"
  | "right-third"
  | "center";

interface AvatarVideoProps {
  src: string;
  position?: AvatarPosition;
  transparent?: boolean;
  circular?: boolean;
  scale?: number;
  offset?: { x: number; y: number };
  shadow?: boolean;
  border?: boolean;
  borderColor?: string;
}

const POSITION_STYLES: Record<AvatarPosition, React.CSSProperties> = {
  fullscreen: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  "bottom-right": {
    position: "absolute",
    bottom: 40,
    right: 40,
    width: "35%",
    height: "auto",
  },
  "bottom-left": {
    position: "absolute",
    bottom: 40,
    left: 40,
    width: "35%",
    height: "auto",
  },
  "top-right": {
    position: "absolute",
    top: 40,
    right: 40,
    width: "30%",
    height: "auto",
  },
  "top-left": {
    position: "absolute",
    top: 40,
    left: 40,
    width: "30%",
    height: "auto",
  },
  "pip-small": {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: "20%",
    height: "auto",
  },
  "pip-medium": {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: "28%",
    height: "auto",
  },
  "left-third": {
    position: "absolute",
    left: 0,
    top: 0,
    width: "33%",
    height: "100%",
    objectFit: "cover",
  },
  "right-third": {
    position: "absolute",
    right: 0,
    top: 0,
    width: "33%",
    height: "100%",
    objectFit: "cover",
  },
  center: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "60%",
    height: "auto",
  },
};

export const AvatarVideo: React.FC<AvatarVideoProps> = ({
  src,
  position = "fullscreen",
  transparent = false,
  circular = false,
  scale = 1,
  offset = { x: 0, y: 0 },
  shadow = false,
  border = false,
  borderColor = "#8b5cf6",
}) => {
  const baseStyle = POSITION_STYLES[position];

  // Build transform string
  let transformStr = "";
  if (position === "center") {
    transformStr = `translate(-50%, -50%) scale(${scale}) translate(${offset.x}px, ${offset.y}px)`;
  } else if (scale !== 1 || offset.x !== 0 || offset.y !== 0) {
    transformStr = `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`;
  }

  const style: React.CSSProperties = {
    ...baseStyle,
    ...(transformStr && { transform: transformStr }),
    ...(circular && {
      borderRadius: "50%",
      overflow: "hidden",
    }),
    ...(shadow && {
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
    }),
    ...(border && {
      border: `3px solid ${borderColor}`,
    }),
  };

  return (
    <OffthreadVideo
      src={src}
      transparent={transparent}
      style={style}
    />
  );
};

export default AvatarVideo;
