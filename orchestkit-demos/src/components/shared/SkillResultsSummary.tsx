/**
 * SkillResultsSummary - Premium Animation Patterns
 *
 * A video summary screen showing results of a skill running at 3 difficulty levels
 * with Apple/Stripe-quality motion design.
 *
 * Animation Patterns Implemented:
 * 1. Staggered Card Reveals (Simple -> Medium -> Advanced)
 * 2. Counter Animations (numbers counting up)
 * 3. Progress Bar Fills
 * 4. Achievement Unlock Effects
 * 5. Confetti/Particle Celebrations
 * 6. Morphing Transitions
 */

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
  Sequence,
} from "remotion";
import { interpolateColors } from "remotion";

// ============================================================================
// TYPES
// ============================================================================

export type DifficultyLevel = "simple" | "medium" | "advanced";

interface FileCreated {
  name: string;
  lines: number;
}

interface PhaseInfo {
  name: string;
  shortName?: string;
}

interface LevelResult {
  level: DifficultyLevel;
  description: string; // What was built (e.g., "JWT auth", "OAuth + JWT + MFA")
  metrics: {
    files: number;
    lines: number;
    tests: number;
    coverage: number;
    time: string;
  };
  achievements: string[];
  filesCreated?: FileCreated[]; // Actual files that were created
}

interface SkillResultsSummaryProps {
  skillName: string;
  results: [LevelResult, LevelResult, LevelResult];
  tagline?: string;
  primaryColor?: string;
  phases?: PhaseInfo[]; // The phases the skill went through
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_COLORS: Record<DifficultyLevel, string> = {
  simple: "#22c55e",
  medium: "#f59e0b",
  advanced: "#8b5cf6",
};

const LEVEL_EMOJIS: Record<DifficultyLevel, string> = {
  simple: "🟢",
  medium: "🟡",
  advanced: "🟣",
};

// ============================================================================
// PATTERN 1: STAGGERED CARD REVEALS
// ============================================================================

/**
 * StaggeredCardReveal - Cards appear one by one with spring physics
 *
 * Uses:
 * - spring() for natural bounce
 * - Staggered delays per card
 * - Scale + opacity combination for premium feel
 */
interface StaggeredCardRevealProps {
  children: React.ReactNode;
  index: number;
  totalCards: number;
  startFrame?: number;
  staggerDelay?: number; // Frames between each card
}

export const StaggeredCardReveal: React.FC<StaggeredCardRevealProps> = ({
  children,
  index,
  totalCards,
  startFrame = 0,
  staggerDelay = 12,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate delay based on position (Simple -> Medium -> Advanced)
  const cardStartFrame = startFrame + index * staggerDelay;
  const adjustedFrame = Math.max(0, frame - cardStartFrame);

  // Spring for scale - gives natural bounce
  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: {
      damping: 12, // Lower = more bounce
      stiffness: 100, // Higher = faster
      mass: 0.8, // Lower = snappier
    },
    from: 0.8,
    to: 1,
  });

  // Spring for Y position - slide up effect
  const translateY = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 15, stiffness: 80 },
    from: 40,
    to: 0,
  });

  // Fade in with easing
  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  // Optional: subtle rotation for more dynamic entry
  const rotate = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 20, stiffness: 120 },
    from: -3,
    to: 0,
  });

  return (
    <div
      style={{
        opacity,
        transform: `
          scale(${scale})
          translateY(${translateY}px)
          rotate(${rotate}deg)
        `,
        transformOrigin: "center bottom",
      }}
    >
      {children}
    </div>
  );
};

// ============================================================================
// PATTERN 2: COUNTER ANIMATIONS
// ============================================================================

/**
 * AnimatedCounter - Numbers count up with various easing options
 *
 * Uses:
 * - interpolate() with custom easing
 * - Optional digit morphing for premium effect
 * - Color interpolation during count
 */
interface AnimatedCounterProps {
  value: number;
  delay?: number;
  duration?: number; // in frames
  prefix?: string;
  suffix?: string;
  color?: string;
  fontSize?: number;
  easing?: "linear" | "easeOut" | "bounce" | "spring";
  formatNumber?: boolean;
  gradientColors?: [string, string];
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  delay = 0,
  duration = 45,
  prefix = "",
  suffix = "",
  color = "#ffffff",
  fontSize = 48,
  easing = "easeOut",
  formatNumber = true,
  gradientColors,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  // Choose easing function
  const getEasing = () => {
    switch (easing) {
      case "linear":
        return (t: number) => t;
      case "bounce":
        return Easing.bounce;
      case "spring":
        // Custom spring-like easing that overshoots slightly
        return Easing.bezier(0.34, 1.56, 0.64, 1);
      case "easeOut":
      default:
        return Easing.out(Easing.cubic);
    }
  };

  // Animate the number
  let animatedValue: number;

  if (easing === "spring") {
    // Use actual spring for most natural feel
    animatedValue = spring({
      frame: adjustedFrame,
      fps,
      config: { damping: 15, stiffness: 100 },
      from: 0,
      to: value,
    });
  } else {
    animatedValue = interpolate(adjustedFrame, [0, duration], [0, value], {
      extrapolateRight: "clamp",
      easing: getEasing(),
    });
  }

  const displayValue = Math.round(animatedValue);
  const formattedValue = formatNumber
    ? displayValue.toLocaleString()
    : displayValue.toString();

  // Optional gradient color during animation
  const displayColor = gradientColors
    ? interpolateColors(
        animatedValue / value,
        [0, 0.5, 1],
        [gradientColors[0], color, gradientColors[1]]
      )
    : color;

  // Entry scale animation
  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  return (
    <div
      style={{
        fontFamily: "Menlo, Monaco, monospace",
        fontSize,
        fontWeight: 700,
        color: displayColor,
        transform: `scale(${scale})`,
        display: "flex",
        alignItems: "baseline",
      }}
    >
      {prefix && (
        <span style={{ fontSize: fontSize * 0.6, marginRight: 4 }}>
          {prefix}
        </span>
      )}
      <span>{formattedValue}</span>
      {suffix && (
        <span style={{ fontSize: fontSize * 0.6, marginLeft: 4 }}>
          {suffix}
        </span>
      )}
    </div>
  );
};

/**
 * DigitMorphCounter - Each digit animates independently for premium effect
 */
interface DigitMorphCounterProps {
  value: number;
  delay?: number;
  color?: string;
  fontSize?: number;
  digitStaggerDelay?: number; // Frames between each digit
}

export const DigitMorphCounter: React.FC<DigitMorphCounterProps> = ({
  value,
  delay = 0,
  color = "#ffffff",
  fontSize = 48,
  digitStaggerDelay = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  // Count up to target value
  const animatedValue = interpolate(adjustedFrame, [0, 45], [0, value], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const digits = Math.round(animatedValue).toString().split("");

  return (
    <div style={{ display: "flex", overflow: "hidden" }}>
      {digits.map((digit, i) => {
        const digitDelay = delay + i * digitStaggerDelay;
        const digitFrame = Math.max(0, frame - digitDelay);

        // Each digit slides up from below
        const y = spring({
          frame: digitFrame,
          fps,
          config: { damping: 12, stiffness: 100 },
          from: fontSize * 0.8,
          to: 0,
        });

        const opacity = interpolate(digitFrame, [0, 10], [0, 1], {
          extrapolateRight: "clamp",
        });

        // Optional: color gradient across digits
        const digitColor = interpolateColors(
          i / Math.max(digits.length - 1, 1),
          [0, 1],
          [color, color]
        );

        return (
          <span
            key={`${i}-${digit}`}
            style={{
              display: "inline-block",
              transform: `translateY(${y}px)`,
              opacity,
              color: digitColor,
              fontSize,
              fontWeight: 700,
              fontFamily: "Menlo, Monaco, monospace",
              width: "0.6em",
              textAlign: "center",
            }}
          >
            {digit}
          </span>
        );
      })}
    </div>
  );
};

// ============================================================================
// PATTERN 3: PROGRESS BAR FILLS
// ============================================================================

/**
 * AnimatedProgressBar - Smooth fill animation with glow effect
 *
 * Uses:
 * - spring() for organic fill
 * - Gradient fills
 * - Glow/shadow effects
 */
interface AnimatedProgressBarProps {
  progress: number; // 0-100
  delay?: number;
  color?: string;
  height?: number;
  width?: number;
  showLabel?: boolean;
  labelPosition?: "inside" | "right";
  glowIntensity?: number;
  gradientColors?: [string, string];
  rounded?: boolean;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  progress,
  delay = 0,
  color = "#8b5cf6",
  height = 24,
  width = 300,
  showLabel = true,
  labelPosition = "right",
  glowIntensity = 0.5,
  gradientColors,
  rounded = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  // Spring-based fill animation
  const animatedProgress = spring({
    frame: adjustedFrame,
    fps,
    config: {
      damping: 20,
      stiffness: 60, // Lower for smoother fill
    },
    from: 0,
    to: progress,
  });

  // Glow animation (subtle pulse when complete)
  const isComplete = animatedProgress >= progress - 1;
  const glowOpacity = isComplete
    ? interpolate(
        Math.sin(frame * 0.1),
        [-1, 1],
        [glowIntensity * 0.5, glowIntensity]
      )
    : glowIntensity * 0.3;

  // Entry animation
  const containerOpacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Gradient fill color
  const fillColor = gradientColors
    ? `linear-gradient(90deg, ${gradientColors[0]}, ${gradientColors[1]})`
    : color;

  const borderRadius = rounded ? height / 2 : 4;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: containerOpacity,
      }}
    >
      {/* Track */}
      <div
        style={{
          width,
          height,
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          borderRadius,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Fill */}
        <div
          style={{
            width: `${animatedProgress}%`,
            height: "100%",
            background: fillColor,
            borderRadius,
            boxShadow: `0 0 ${20 * glowOpacity}px ${color}`,
            position: "relative",
          }}
        >
          {/* Shine effect */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "50%",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)",
              borderRadius: `${borderRadius}px ${borderRadius}px 0 0`,
            }}
          />

          {/* Inside label */}
          {showLabel && labelPosition === "inside" && (
            <span
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: height * 0.5,
                fontWeight: 600,
                color: "#fff",
                fontFamily: "Inter, system-ui",
                opacity: animatedProgress > 20 ? 1 : 0,
              }}
            >
              {Math.round(animatedProgress)}%
            </span>
          )}
        </div>
      </div>

      {/* Outside label */}
      {showLabel && labelPosition === "right" && (
        <span
          style={{
            fontSize: height * 0.7,
            fontWeight: 700,
            color,
            fontFamily: "Menlo, Monaco, monospace",
            minWidth: 50,
          }}
        >
          {Math.round(animatedProgress)}%
        </span>
      )}
    </div>
  );
};

/**
 * CircularProgress - Donut-style progress indicator
 */
interface CircularProgressProps {
  progress: number;
  delay?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showLabel?: boolean;
  gradientColors?: [string, string];
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  delay = 0,
  size = 120,
  strokeWidth = 12,
  color = "#8b5cf6",
  showLabel = true,
  gradientColors,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  // Spring animation for progress
  const animatedProgress = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 20, stiffness: 80 },
    from: 0,
    to: progress,
  });

  // SVG calculations
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - animatedProgress / 100);

  // Entry animation
  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  // Dynamic color
  const strokeColor = gradientColors
    ? interpolateColors(animatedProgress / 100, [0, 1], gradientColors)
    : color;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        transform: `scale(${scale})`,
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            filter: `drop-shadow(0 0 8px ${strokeColor})`,
          }}
        />
      </svg>

      {/* Center label */}
      {showLabel && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <span
            style={{
              fontSize: size * 0.25,
              fontWeight: 700,
              color: strokeColor,
              fontFamily: "Menlo, Monaco, monospace",
            }}
          >
            {Math.round(animatedProgress)}%
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PATTERN 4: ACHIEVEMENT UNLOCK EFFECTS
// ============================================================================

/**
 * AchievementUnlock - Trophy/badge reveal with celebration
 *
 * Uses:
 * - Scale overshoot with spring
 * - Particle burst
 * - Glow pulse
 */
interface AchievementUnlockProps {
  icon: string;
  title: string;
  description?: string;
  delay?: number;
  color?: string;
}

export const AchievementUnlock: React.FC<AchievementUnlockProps> = ({
  icon,
  title,
  description,
  delay = 0,
  color = "#f59e0b",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  // Icon entry with overshoot
  const iconScale = spring({
    frame: adjustedFrame,
    fps,
    config: {
      damping: 8, // Low damping = more bounce
      stiffness: 150,
      mass: 0.5,
    },
    from: 0,
    to: 1,
  });

  // Glow pulse
  const glowIntensity = adjustedFrame > 20
    ? interpolate(
        Math.sin((adjustedFrame - 20) * 0.15),
        [-1, 1],
        [0.3, 0.8]
      )
    : interpolate(adjustedFrame, [0, 20], [0, 0.5], {
        extrapolateRight: "clamp",
      });

  // Ring expansion
  const ringScale = interpolate(adjustedFrame, [10, 40], [0.5, 1.5], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });
  const ringOpacity = interpolate(adjustedFrame, [10, 40], [0.8, 0], {
    extrapolateRight: "clamp",
  });

  // Text reveal
  const textOpacity = interpolate(adjustedFrame, [15, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textY = spring({
    frame: Math.max(0, adjustedFrame - 15),
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 20,
    to: 0,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        position: "relative",
      }}
    >
      {/* Expanding ring */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${ringScale})`,
          width: 80,
          height: 80,
          borderRadius: "50%",
          border: `2px solid ${color}`,
          opacity: ringOpacity,
        }}
      />

      {/* Icon container */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          backgroundColor: `${color}20`,
          border: `3px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${iconScale})`,
          boxShadow: `0 0 ${30 * glowIntensity}px ${color}`,
        }}
      >
        <span style={{ fontSize: 36 }}>{icon}</span>
      </div>

      {/* Text */}
      <div
        style={{
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color,
            fontFamily: "Inter, system-ui",
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: 12,
              color: "#9ca3af",
              marginTop: 4,
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// PATTERN 5: CONFETTI/PARTICLE CELEBRATIONS
// ============================================================================

/**
 * ConfettiExplosion - Particle burst celebration effect
 *
 * Uses:
 * - Physics-based particle motion
 * - Gravity simulation
 * - Color variation
 */
interface ConfettiExplosionProps {
  startFrame: number;
  particleCount?: number;
  colors?: string[];
  originX?: number;
  originY?: number;
  spread?: number;
  gravity?: number;
}

export const ConfettiExplosion: React.FC<ConfettiExplosionProps> = ({
  startFrame,
  particleCount = 50,
  colors = ["#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6"],
  originX = 0.5,
  originY = 0.5,
  spread = 200,
  gravity = 0.3,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - startFrame);

  // Generate particles with deterministic positions
  const particles = React.useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      // Use index for deterministic "randomness"
      const seed = i * 1.618033988749895; // Golden ratio for distribution
      const angle = (seed * 360) % 360;
      const velocity = 5 + (seed % 10);
      const rotationSpeed = (seed % 20) - 10;
      const color = colors[i % colors.length];
      const size = 6 + (seed % 8);
      const shape = i % 3; // 0: square, 1: circle, 2: rectangle

      return {
        angle: (angle * Math.PI) / 180,
        velocity,
        rotationSpeed,
        color,
        size,
        shape,
        delay: Math.floor(seed % 10),
      };
    });
  }, [particleCount, colors]);

  // Only render if animation has started
  if (adjustedFrame < 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {particles.map((particle, i) => {
        const t = Math.max(0, adjustedFrame - particle.delay) / fps;

        // Physics calculations
        const vx = Math.cos(particle.angle) * particle.velocity * spread;
        const vy = Math.sin(particle.angle) * particle.velocity * spread;

        const x = originX * width + vx * t;
        const y = originY * height + vy * t + 0.5 * gravity * 1000 * t * t;

        // Fade out
        const opacity = interpolate(
          adjustedFrame - particle.delay,
          [0, 20, 60],
          [0, 1, 0],
          { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
        );

        // Rotation
        const rotation = t * particle.rotationSpeed * 360;

        // Shape rendering
        const shapeStyle: React.CSSProperties = {
          position: "absolute",
          left: x,
          top: y,
          width: particle.size,
          height: particle.shape === 2 ? particle.size / 2 : particle.size,
          backgroundColor: particle.color,
          borderRadius: particle.shape === 1 ? "50%" : 2,
          transform: `rotate(${rotation}deg)`,
          opacity,
        };

        return <div key={i} style={shapeStyle} />;
      })}
    </div>
  );
};

/**
 * StarBurst - Radial particle burst (simpler, more focused)
 */
interface StarBurstProps {
  startFrame: number;
  color: string;
  particleCount?: number;
  size?: number;
}

export const StarBurst: React.FC<StarBurstProps> = ({
  startFrame,
  color,
  particleCount = 12,
  size = 80,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - startFrame);

  const particles = Array.from({ length: particleCount }, (_, i) => {
    const angle = (i / particleCount) * Math.PI * 2;

    // Distance animation
    const distance = interpolate(adjustedFrame, [0, 30], [0, size], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.ease),
    });

    // Fade out
    const opacity = interpolate(adjustedFrame, [0, 15, 30], [0, 1, 0], {
      extrapolateRight: "clamp",
    });

    // Scale down
    const particleScale = interpolate(adjustedFrame, [0, 30], [1, 0.3], {
      extrapolateRight: "clamp",
    });

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          width: 8 * particleScale,
          height: 8 * particleScale,
          borderRadius: "50%",
          backgroundColor: color,
          transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`,
          opacity,
          boxShadow: `0 0 10px ${color}`,
        }}
      />
    );
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      {particles}
    </div>
  );
};

// ============================================================================
// PATTERN 6: MORPHING TRANSITIONS
// ============================================================================

/**
 * MorphingCard - Card that morphs between states
 *
 * Uses:
 * - Interpolated colors
 * - Smooth dimension changes
 * - Content crossfade
 */
interface MorphingCardProps {
  fromState: {
    backgroundColor: string;
    borderColor: string;
    width: number;
    height: number;
  };
  toState: {
    backgroundColor: string;
    borderColor: string;
    width: number;
    height: number;
  };
  progress: number; // 0-1
  children: React.ReactNode;
}

export const MorphingCard: React.FC<MorphingCardProps> = ({
  fromState,
  toState,
  progress,
  children,
}) => {
  // Interpolate all properties
  const backgroundColor = interpolateColors(
    progress,
    [0, 1],
    [fromState.backgroundColor, toState.backgroundColor]
  );

  const borderColor = interpolateColors(
    progress,
    [0, 1],
    [fromState.borderColor, toState.borderColor]
  );

  const width = interpolate(
    progress,
    [0, 1],
    [fromState.width, toState.width],
    { easing: Easing.inOut(Easing.ease) }
  );

  const height = interpolate(
    progress,
    [0, 1],
    [fromState.height, toState.height],
    { easing: Easing.inOut(Easing.ease) }
  );

  return (
    <div
      style={{
        width,
        height,
        backgroundColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
};

/**
 * LevelTransitionMorph - Morph between difficulty levels
 */
interface LevelTransitionMorphProps {
  fromLevel: DifficultyLevel;
  toLevel: DifficultyLevel;
  startFrame: number;
  duration?: number;
  children: React.ReactNode;
}

export const LevelTransitionMorph: React.FC<LevelTransitionMorphProps> = ({
  fromLevel,
  toLevel,
  startFrame,
  duration = 30,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - startFrame);

  // Use spring for natural morph
  const progress = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 15, stiffness: 80 },
    from: 0,
    to: 1,
  });

  // Morph colors
  const backgroundColor = interpolateColors(
    progress,
    [0, 1],
    [`${LEVEL_COLORS[fromLevel]}20`, `${LEVEL_COLORS[toLevel]}20`]
  );

  const borderColor = interpolateColors(
    progress,
    [0, 1],
    [LEVEL_COLORS[fromLevel], LEVEL_COLORS[toLevel]]
  );

  // Morph emoji with crossfade
  const fromOpacity = interpolate(progress, [0, 0.5], [1, 0], {
    extrapolateRight: "clamp",
  });
  const toOpacity = interpolate(progress, [0.5, 1], [0, 1], {
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        backgroundColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 16,
        padding: 20,
        position: "relative",
      }}
    >
      {/* Emoji transition */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          fontSize: 24,
        }}
      >
        <span style={{ opacity: fromOpacity }}>{LEVEL_EMOJIS[fromLevel]}</span>
        <span
          style={{
            opacity: toOpacity,
            position: "absolute",
            left: 0,
          }}
        >
          {LEVEL_EMOJIS[toLevel]}
        </span>
      </div>

      {children}
    </div>
  );
};

// ============================================================================
// SUBCOMPONENT: STAT BOX (must be defined before EnhancedLevelCard)
// ============================================================================

interface StatBoxProps {
  label: string;
  value: number;
  color: string;
  delay: number;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, color, delay }) => {
  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <span style={{ fontSize: 11, color: "#9ca3af" }}>{label}</span>
      <DigitMorphCounter value={value} delay={delay} color={color} fontSize={22} />
    </div>
  );
};

// ============================================================================
// SUBCOMPONENT: ENHANCED LEVEL CARD (WHAT WAS BUILT)
// ============================================================================

interface EnhancedLevelCardProps {
  result: LevelResult;
  startFrame: number;
  showStats: boolean;
}

const EnhancedLevelCard: React.FC<EnhancedLevelCardProps> = ({
  result,
  startFrame,
  showStats,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const color = LEVEL_COLORS[result.level];
  const emoji = LEVEL_EMOJIS[result.level];
  const adjustedFrame = Math.max(0, frame - startFrame);

  return (
    <div
      style={{
        width: 380,
        backgroundColor: `${color}08`,
        border: `2px solid ${color}`,
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header with level badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>{emoji}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {result.level}
          </span>
        </div>
        <span style={{ fontFamily: "Menlo, Monaco, monospace", fontSize: 14, fontWeight: 600, color, backgroundColor: `${color}20`, padding: "4px 10px", borderRadius: 6 }}>
          {result.metrics.time}
        </span>
      </div>

      {/* Description - WHAT was built */}
      <div style={{ backgroundColor: `${color}15`, borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${color}` }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#f8fafc" }}>{result.description}</span>
      </div>

      {/* Stats Grid */}
      {showStats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatBox label="Files" value={result.metrics.files} color={color} delay={startFrame + 5} />
          <StatBox label="Lines" value={result.metrics.lines} color={color} delay={startFrame + 8} />
          <StatBox label="Tests" value={result.metrics.tests} color={color} delay={startFrame + 11} />
          <div style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>Coverage</span>
            <AnimatedProgressBar progress={result.metrics.coverage} delay={startFrame + 14} color={color} height={10} width={140} showLabel={true} labelPosition="inside" gradientColors={[`${color}60`, color]} />
          </div>
        </div>
      )}

      {/* Files Created Tags */}
      {result.achievements.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {result.achievements.slice(0, 4).map((achievement, i) => {
            const tagOpacity = interpolate(adjustedFrame, [20 + i * 4, 28 + i * 4], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
            const tagScale = spring({ frame: Math.max(0, adjustedFrame - 20 - i * 4), fps, config: { damping: 15, stiffness: 200 } });
            return (
              <div key={i} style={{ backgroundColor: `${color}25`, borderRadius: 12, padding: "3px 10px", fontSize: 11, color, fontFamily: "Menlo, Monaco, monospace", opacity: tagOpacity, transform: `scale(${tagScale})` }}>
                {achievement}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUBCOMPONENT: BIG STAT WITH MORPH (for totals row)
// ============================================================================

interface BigStatWithMorphProps {
  label: string;
  value: number;
  delay: number;
  color: string;
}

const BigStatWithMorph: React.FC<BigStatWithMorphProps> = ({ label, value, delay, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 15, stiffness: 150 } });
  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity, transform: `scale(${scale})` }}>
      <DigitMorphCounter value={value} delay={delay + 5} color={color} fontSize={36} digitStaggerDelay={2} />
      <span style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
    </div>
  );
};

// ============================================================================
// SUBCOMPONENT: PHASE TIMELINE (HOW IT PROGRESSED)
// ============================================================================

interface PhaseTimelineProps {
  phases: PhaseInfo[];
  startFrame: number;
  primaryColor: string;
}

const PhaseTimeline: React.FC<PhaseTimelineProps> = ({ phases, startFrame, primaryColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - startFrame);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(10, 10, 15, 0.9)", padding: "12px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
      <span style={{ fontSize: 12, color: "#6b7280", marginRight: 8 }}>Phases:</span>
      {phases.map((phase, index) => {
        const phaseDelay = index * 8;
        const isComplete = adjustedFrame > phaseDelay + 20;
        const opacity = interpolate(adjustedFrame, [phaseDelay, phaseDelay + 10], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
        const checkScale = spring({ frame: Math.max(0, adjustedFrame - phaseDelay - 15), fps, config: { damping: 10, stiffness: 200 } });
        return (
          <React.Fragment key={phase.name}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, opacity, backgroundColor: isComplete ? `${primaryColor}20` : "transparent", padding: "4px 10px", borderRadius: 6, border: isComplete ? `1px solid ${primaryColor}40` : "1px solid transparent" }}>
              <span style={{ fontSize: 14, color: isComplete ? primaryColor : "#9ca3af", transform: `scale(${isComplete ? checkScale : 0})` }}>✓</span>
              <span style={{ fontSize: 12, fontWeight: isComplete ? 600 : 400, color: isComplete ? "#f8fafc" : "#9ca3af" }}>{phase.shortName || phase.name}</span>
            </div>
            {index < phases.length - 1 && <span style={{ color: "#4b5563", fontSize: 10 }}>→</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ============================================================================
// SUBCOMPONENT: CTA BUTTON
// ============================================================================

interface CTAButtonProps {
  command: string;
  primaryColor: string;
  startFrame: number;
}

const CTAButton: React.FC<CTAButtonProps> = ({ command, primaryColor, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - startFrame);
  const scale = spring({ frame: adjustedFrame, fps, config: { damping: 12, stiffness: 100 } });
  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const pulse = 1 + 0.02 * Math.sin(adjustedFrame * 0.15);

  return (
    <div style={{ display: "inline-block", backgroundColor: `${primaryColor}15`, border: `2px solid ${primaryColor}`, borderRadius: 12, padding: "14px 28px", opacity, transform: `scale(${scale * pulse})`, boxShadow: `0 0 30px ${primaryColor}30` }}>
      <span style={{ fontSize: 13, color: "#9ca3af", marginRight: 8 }}>Try it:</span>
      <span style={{ fontFamily: "Menlo, Monaco, monospace", fontSize: 18, fontWeight: 600, color: primaryColor }}>{command}</span>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT: SKILL RESULTS SUMMARY
// ============================================================================

/**
 * SkillResultsSummary - Complete results screen with all animation patterns
 *
 * Shows 3 sections:
 * 1. WHAT was built - level cards with descriptions & files
 * 2. HOW it progressed - phase timeline with circular progress
 * 3. WHY it matters - CTA with achievement unlock
 */
export const SkillResultsSummary: React.FC<SkillResultsSummaryProps> = ({
  skillName,
  results,
  tagline = "Same skill. Any scale. Same quality.",
  primaryColor = "#8b5cf6",
  phases = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Timeline - tighter for more impact
  const whatBuiltStart = fps * 0.8;
  const cardRevealStart = fps * 1;
  const statsRevealStart = fps * 2;
  const achievementStart = fps * 3.5;
  const celebrationStart = fps * 4;
  const ctaStart = fps * 4.5;

  // Title animation
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Calculate totals for the "big numbers" section
  const totalFiles = results.reduce((sum, r) => sum + r.metrics.files, 0);
  const totalLines = results.reduce((sum, r) => sum + r.metrics.lines, 0);
  const totalTests = results.reduce((sum, r) => sum + r.metrics.tests, 0);
  const avgCoverage = Math.round(
    results.reduce((sum, r) => sum + r.metrics.coverage, 0) / 3
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Animated background with level colors */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 15% 20%, ${LEVEL_COLORS.simple}15 0%, transparent 35%),
            radial-gradient(ellipse at 50% 50%, ${LEVEL_COLORS.medium}12 0%, transparent 35%),
            radial-gradient(ellipse at 85% 80%, ${LEVEL_COLORS.advanced}15 0%, transparent 35%)
          `,
        }}
      />

      {/* ========== TITLE SECTION ========== */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
        }}
      >
        <h1
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: "#f8fafc",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          ✅ {skillName} Complete
        </h1>
        <p
          style={{
            fontSize: 18,
            color: "#94a3b8",
            marginTop: 6,
          }}
        >
          {tagline}
        </p>
      </div>

      {/* ========== WHAT WAS BUILT - 3 Level Cards ========== */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 20,
          padding: "0 30px",
        }}
      >
        {results.map((result, index) => (
          <StaggeredCardReveal
            key={result.level}
            index={index}
            totalCards={3}
            startFrame={cardRevealStart}
            staggerDelay={12}
          >
            <EnhancedLevelCard
              result={result}
              startFrame={cardRevealStart + index * 12}
              showStats={frame > statsRevealStart + index * 8}
            />
          </StaggeredCardReveal>
        ))}
      </div>

      {/* ========== BIG TOTALS ROW ========== */}
      <Sequence from={statsRevealStart} durationInFrames={fps * 10}>
        <div
          style={{
            position: "absolute",
            top: 480,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 60,
          }}
        >
          <BigStatWithMorph
            label="Total Files"
            value={totalFiles}
            delay={0}
            color={LEVEL_COLORS.simple}
          />
          <BigStatWithMorph
            label="Lines of Code"
            value={totalLines}
            delay={5}
            color={LEVEL_COLORS.medium}
          />
          <BigStatWithMorph
            label="Test Cases"
            value={totalTests}
            delay={10}
            color={LEVEL_COLORS.advanced}
          />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <CircularProgress
              progress={avgCoverage}
              delay={15}
              size={70}
              strokeWidth={8}
              color={primaryColor}
              gradientColors={[LEVEL_COLORS.simple, LEVEL_COLORS.advanced]}
            />
            <span style={{ fontSize: 12, color: "#9ca3af" }}>Avg Coverage</span>
          </div>
        </div>
      </Sequence>

      {/* ========== PHASE TIMELINE (HOW IT PROGRESSED) ========== */}
      {phases.length > 0 && (
        <Sequence from={whatBuiltStart} durationInFrames={fps * 10}>
          <div
            style={{
              position: "absolute",
              bottom: 130,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <PhaseTimeline phases={phases} startFrame={0} primaryColor={primaryColor} />
          </div>
        </Sequence>
      )}

      {/* ========== ACHIEVEMENT UNLOCK ========== */}
      <Sequence from={achievementStart} durationInFrames={fps * 3}>
        <div
          style={{
            position: "absolute",
            top: 560,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <AchievementUnlock
            icon="🏆"
            title="All Levels Complete!"
            description={`${totalFiles} files • ${totalLines} lines • ${totalTests} tests`}
            delay={0}
            color={primaryColor}
          />
        </div>
      </Sequence>

      {/* ========== CONFETTI CELEBRATION ========== */}
      <Sequence from={celebrationStart} durationInFrames={fps * 2}>
        <ConfettiExplosion
          startFrame={0}
          particleCount={80}
          colors={[
            LEVEL_COLORS.simple,
            LEVEL_COLORS.medium,
            LEVEL_COLORS.advanced,
            "#ffffff",
          ]}
          originY={0.5}
          spread={250}
        />
        {/* Star bursts at each card position */}
        <div style={{ position: "absolute", top: 250, left: "20%" }}>
          <StarBurst startFrame={5} color={LEVEL_COLORS.simple} size={60} />
        </div>
        <div style={{ position: "absolute", top: 250, left: "50%", transform: "translateX(-50%)" }}>
          <StarBurst startFrame={10} color={LEVEL_COLORS.medium} size={60} />
        </div>
        <div style={{ position: "absolute", top: 250, right: "20%" }}>
          <StarBurst startFrame={15} color={LEVEL_COLORS.advanced} size={60} />
        </div>
      </Sequence>

      {/* ========== CTA ========== */}
      <Sequence from={ctaStart} durationInFrames={fps * 10}>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <CTAButton
            command={`/ork:${skillName.toLowerCase().replace(/\s+/g, "-")}`}
            primaryColor={primaryColor}
            startFrame={0}
          />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

// ============================================================================
// LEGACY SUBCOMPONENTS (kept for backwards compatibility)
// ============================================================================

interface LevelResultCardProps {
  result: LevelResult;
  startFrame: number;
}

const LevelResultCard: React.FC<LevelResultCardProps> = ({
  result,
  startFrame,
}) => {
  // Delegate to enhanced version
  return (
    <EnhancedLevelCard result={result} startFrame={startFrame} showStats={true} />
  );
};

interface MetricRowProps {
  label: string;
  value: number;
  delay: number;
  color: string;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value, delay, color }) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 14, color: "#9ca3af" }}>{label}</span>
      <AnimatedCounter
        value={value}
        delay={delay}
        color={color}
        fontSize={24}
        easing="spring"
        formatNumber={true}
      />
    </div>
  );
};

export default SkillResultsSummary;
