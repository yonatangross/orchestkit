import React from "react";
import {
  useCurrentFrame,
  interpolate,
  Easing,
  AbsoluteFill,
} from "remotion";

type WipeDirection = "left" | "right" | "up" | "down" | "diagonal";

interface TransitionWipeProps {
  direction?: WipeDirection;
  color?: string;
  startFrame: number;
  durationFrames?: number;
  children?: React.ReactNode;
}

export const TransitionWipe: React.FC<TransitionWipeProps> = ({
  direction = "left",
  color = "#8b5cf6",
  startFrame,
  durationFrames = 15,
  children,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames / 2, startFrame + durationFrames],
    [0, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease),
    }
  );

  const getTransform = () => {
    const offset = (1 - progress) * 100;
    switch (direction) {
      case "left":
        return `translateX(${-offset}%)`;
      case "right":
        return `translateX(${offset}%)`;
      case "up":
        return `translateY(${-offset}%)`;
      case "down":
        return `translateY(${offset}%)`;
      case "diagonal":
        return `translate(${-offset}%, ${-offset}%)`;
      default:
        return "none";
    }
  };

  if (progress === 0) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <AbsoluteFill
        style={{
          backgroundColor: color,
          transform: getTransform(),
        }}
      />
    </>
  );
};

interface CrossfadeProps {
  startFrame: number;
  durationFrames?: number;
  from: React.ReactNode;
  to: React.ReactNode;
}

export const Crossfade: React.FC<CrossfadeProps> = ({
  startFrame,
  durationFrames = 20,
  from,
  to,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <>
      <AbsoluteFill style={{ opacity: 1 - progress }}>{from}</AbsoluteFill>
      <AbsoluteFill style={{ opacity: progress }}>{to}</AbsoluteFill>
    </>
  );
};

interface SceneTransitionProps {
  type?: "fade" | "wipe" | "zoom";
  color?: string;
  startFrame: number;
  durationFrames?: number;
}

export const SceneTransition: React.FC<SceneTransitionProps> = ({
  type = "fade",
  color = "#0a0a0f",
  startFrame,
  durationFrames = 10,
}) => {
  const frame = useCurrentFrame();

  // Fade in then fade out
  const opacity = interpolate(
    frame,
    [
      startFrame,
      startFrame + durationFrames / 2,
      startFrame + durationFrames,
    ],
    [0, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  if (opacity === 0) return null;

  if (type === "zoom") {
    const scale = interpolate(
      frame,
      [startFrame, startFrame + durationFrames / 2, startFrame + durationFrames],
      [0.8, 1, 1.2],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );

    return (
      <AbsoluteFill
        style={{
          backgroundColor: color,
          opacity,
          transform: `scale(${scale})`,
        }}
      />
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        opacity,
      }}
    />
  );
};
