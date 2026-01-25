import React from "react";
import {
  useCurrentFrame,
  interpolate,
  Easing,
  AbsoluteFill,
  spring,
  useVideoConfig,
} from "remotion";

type WipeDirection = "left" | "right" | "up" | "down" | "diagonal";
type TransitionType = "fade" | "wipe" | "zoom" | "slide" | "flip" | "circle" | "blinds" | "pixelate";

// ============================================================================
// TRANSITION WIPE (Basic directional wipe)
// ============================================================================

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

// ============================================================================
// CROSSFADE (Opacity-based transition between two scenes)
// ============================================================================

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

// ============================================================================
// SCENE TRANSITION (Multi-type transition overlay)
// ============================================================================

interface SceneTransitionProps {
  type?: TransitionType;
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
  useVideoConfig(); // Access for potential future use

  // Progress: fade in then fade out
  const progress = interpolate(
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

  if (progress === 0) return null;

  switch (type) {
    case "zoom": {
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
            opacity: progress,
            transform: `scale(${scale})`,
          }}
        />
      );
    }

    case "slide": {
      const slideProgress = interpolate(
        frame,
        [startFrame, startFrame + durationFrames / 2, startFrame + durationFrames],
        [-100, 0, 100],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.ease),
        }
      );

      return (
        <AbsoluteFill
          style={{
            backgroundColor: color,
            transform: `translateX(${slideProgress}%)`,
          }}
        />
      );
    }

    case "flip": {
      const flipProgress = interpolate(
        frame,
        [startFrame, startFrame + durationFrames / 2, startFrame + durationFrames],
        [0, 90, 180],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.ease),
        }
      );

      return (
        <AbsoluteFill
          style={{
            backgroundColor: color,
            opacity: Math.abs(Math.cos((flipProgress * Math.PI) / 180)),
            transform: `perspective(1000px) rotateY(${flipProgress}deg)`,
            backfaceVisibility: "hidden",
          }}
        />
      );
    }

    case "circle": {
      // Circular reveal from center
      const circleProgress = interpolate(
        frame,
        [startFrame, startFrame + durationFrames / 2, startFrame + durationFrames],
        [0, 150, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.ease),
        }
      );

      return (
        <AbsoluteFill
          style={{
            backgroundColor: color,
            clipPath: `circle(${circleProgress}% at 50% 50%)`,
          }}
        />
      );
    }

    case "blinds": {
      // Venetian blinds effect
      const blindCount = 10;
      const blinds = Array.from({ length: blindCount }, (_, i) => {
        const blindDelay = i * (durationFrames / blindCount / 3);
        const blindProgress = interpolate(
          frame,
          [
            startFrame + blindDelay,
            startFrame + durationFrames / 2,
            startFrame + durationFrames - blindDelay,
          ],
          [0, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${(i / blindCount) * 100}%`,
              left: 0,
              right: 0,
              height: `${(100 / blindCount) * blindProgress}%`,
              backgroundColor: color,
            }}
          />
        );
      });

      return <AbsoluteFill>{blinds}</AbsoluteFill>;
    }

    case "pixelate": {
      // Pixelation effect using clip-path grid
      const pixelSize = interpolate(
        frame,
        [startFrame, startFrame + durationFrames / 2, startFrame + durationFrames],
        [1, 50, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }
      );

      return (
        <AbsoluteFill
          style={{
            backgroundColor: color,
            opacity: progress,
            filter: `blur(${pixelSize / 10}px)`,
          }}
        />
      );
    }

    case "wipe": {
      const wipeProgress = interpolate(
        frame,
        [startFrame, startFrame + durationFrames / 2, startFrame + durationFrames],
        [0, 100, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.ease),
        }
      );

      return (
        <AbsoluteFill
          style={{
            backgroundColor: color,
            clipPath: `inset(0 ${100 - wipeProgress}% 0 0)`,
          }}
        />
      );
    }

    case "fade":
    default:
      return (
        <AbsoluteFill
          style={{
            backgroundColor: color,
            opacity: progress,
          }}
        />
      );
  }
};

// ============================================================================
// SLIDE TRANSITION (Content slides in/out)
// ============================================================================

interface SlideTransitionProps {
  children: React.ReactNode;
  direction?: "left" | "right" | "up" | "down";
  startFrame: number;
  durationFrames?: number;
  exitFrame?: number;
}

export const SlideTransition: React.FC<SlideTransitionProps> = ({
  children,
  direction = "up",
  startFrame,
  // durationFrames reserved for future use
  exitFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entry animation
  const entryProgress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  // Exit animation (optional)
  let exitProgress = 0;
  if (exitFrame !== undefined && frame >= exitFrame) {
    exitProgress = spring({
      frame: frame - exitFrame,
      fps,
      config: { damping: 20, stiffness: 100 },
    });
  }

  const offsets = {
    left: { entry: { x: -100, y: 0 }, exit: { x: 100, y: 0 } },
    right: { entry: { x: 100, y: 0 }, exit: { x: -100, y: 0 } },
    up: { entry: { x: 0, y: 50 }, exit: { x: 0, y: -50 } },
    down: { entry: { x: 0, y: -50 }, exit: { x: 0, y: 50 } },
  };

  const offset = offsets[direction];
  const x = interpolate(entryProgress, [0, 1], [offset.entry.x, 0]) +
    interpolate(exitProgress, [0, 1], [0, offset.exit.x]);
  const y = interpolate(entryProgress, [0, 1], [offset.entry.y, 0]) +
    interpolate(exitProgress, [0, 1], [0, offset.exit.y]);
  const opacity = entryProgress * (1 - exitProgress);

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${x}px, ${y}px)`,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ============================================================================
// SCALE TRANSITION (Content scales in/out)
// ============================================================================

interface ScaleTransitionProps {
  children: React.ReactNode;
  startFrame: number;
  durationFrames?: number;
  exitFrame?: number;
  scaleFrom?: number;
  scaleTo?: number;
}

export const ScaleTransition: React.FC<ScaleTransitionProps> = ({
  children,
  startFrame,
  // durationFrames reserved for future use
  exitFrame,
  scaleFrom = 0.8,
  scaleTo = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entry animation
  const entryProgress = spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  // Exit animation (optional)
  let exitProgress = 0;
  if (exitFrame !== undefined && frame >= exitFrame) {
    exitProgress = spring({
      frame: frame - exitFrame,
      fps,
      config: { damping: 15, stiffness: 120 },
    });
  }

  const scale = interpolate(entryProgress, [0, 1], [scaleFrom, scaleTo]) *
    interpolate(exitProgress, [0, 1], [1, 0.8]);
  const opacity = entryProgress * (1 - exitProgress);

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ============================================================================
// REVEAL TRANSITION (Clip-path based reveal)
// ============================================================================

interface RevealTransitionProps {
  children: React.ReactNode;
  type?: "horizontal" | "vertical" | "diagonal" | "circle";
  startFrame: number;
  durationFrames?: number;
  direction?: "forward" | "reverse";
}

export const RevealTransition: React.FC<RevealTransitionProps> = ({
  children,
  type = "horizontal",
  startFrame,
  durationFrames = 25,
  direction = "forward",
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - startFrame);

  const progress = interpolate(adjustedFrame, [0, durationFrames], [0, 100], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const clipPaths = {
    horizontal: direction === "forward"
      ? `inset(0 ${100 - progress}% 0 0)`
      : `inset(0 0 0 ${100 - progress}%)`,
    vertical: direction === "forward"
      ? `inset(${100 - progress}% 0 0 0)`
      : `inset(0 0 ${100 - progress}% 0)`,
    diagonal: `polygon(0 0, ${progress}% 0, ${progress}% ${progress}%, 0 ${progress}%)`,
    circle: `circle(${progress * 1.5}% at 50% 50%)`,
  };

  const opacity = interpolate(adjustedFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        clipPath: clipPaths[type],
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
