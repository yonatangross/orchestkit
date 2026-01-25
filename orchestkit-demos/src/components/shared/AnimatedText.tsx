import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";

type AnimationType =
  | "spring"
  | "fade"
  | "typewriter"
  | "slide"
  | "blur"
  | "wave"
  | "gradient"
  | "split"
  | "reveal";

type EasingPreset = "linear" | "ease" | "bounce" | "elastic" | "back";

interface AnimatedTextProps {
  text: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  delay?: number;
  animation?: AnimationType;
  slideDirection?: "up" | "down" | "left" | "right";
  easingPreset?: EasingPreset;
  gradientColors?: [string, string];
  style?: React.CSSProperties;
}

// Easing presets
const easingFunctions: Record<EasingPreset, (t: number) => number> = {
  linear: (t) => t,
  ease: Easing.inOut(Easing.ease),
  bounce: Easing.bounce,
  elastic: Easing.elastic(1),
  back: Easing.back(1.5),
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  color = "#ffffff",
  fontSize = 32,
  fontFamily = "Inter, system-ui",
  fontWeight = 600,
  delay = 0,
  animation = "spring",
  slideDirection = "up",
  easingPreset = "ease",
  gradientColors,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);
  const easing = easingFunctions[easingPreset];

  const baseStyle: React.CSSProperties = {
    color,
    fontSize,
    fontFamily,
    fontWeight,
    display: "inline-block",
    ...style,
  };

  // Handle each animation type
  switch (animation) {
    case "spring": {
      const scale = spring({
        frame: adjustedFrame,
        fps,
        config: { damping: 80, stiffness: 200 },
      });
      const opacity = Math.min(1, adjustedFrame / 10);
      return (
        <span style={{ ...baseStyle, opacity, transform: `scale(${scale})` }}>
          {text}
        </span>
      );
    }

    case "fade": {
      const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
        easing,
      });
      return <span style={{ ...baseStyle, opacity }}>{text}</span>;
    }

    case "typewriter": {
      const charsToShow = Math.floor(adjustedFrame / 2);
      const cursorVisible = frame % 10 < 5;
      return (
        <span style={baseStyle}>
          {text.slice(0, charsToShow)}
          {charsToShow < text.length && (
            <span style={{ opacity: cursorVisible ? 1 : 0 }}>|</span>
          )}
        </span>
      );
    }

    case "slide": {
      const offsets = {
        up: { x: 0, y: 30 },
        down: { x: 0, y: -30 },
        left: { x: 30, y: 0 },
        right: { x: -30, y: 0 },
      };
      const offset = offsets[slideDirection];

      const translateX = interpolate(adjustedFrame, [0, 20], [offset.x, 0], {
        extrapolateRight: "clamp",
        easing,
      });
      const translateY = interpolate(adjustedFrame, [0, 20], [offset.y, 0], {
        extrapolateRight: "clamp",
        easing,
      });
      const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
      });

      return (
        <span
          style={{
            ...baseStyle,
            opacity,
            transform: `translate(${translateX}px, ${translateY}px)`,
          }}
        >
          {text}
        </span>
      );
    }

    // NEW: Blur reveal animation
    case "blur": {
      const blur = interpolate(adjustedFrame, [0, 20], [12, 0], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.ease),
      });
      const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
      });
      const scale = interpolate(adjustedFrame, [0, 20], [1.1, 1], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.ease),
      });

      return (
        <span
          style={{
            ...baseStyle,
            opacity,
            filter: `blur(${blur}px)`,
            transform: `scale(${scale})`,
          }}
        >
          {text}
        </span>
      );
    }

    // NEW: Wave animation (character-by-character bounce)
    case "wave": {
      const chars = text.split("");
      return (
        <span style={baseStyle}>
          {chars.map((char, i) => {
            const charDelay = i * 2;
            const charFrame = Math.max(0, adjustedFrame - charDelay);

            const y = spring({
              frame: charFrame,
              fps,
              config: { damping: 10, stiffness: 120 }, // Bouncy!
              from: -25,
              to: 0,
            });

            const opacity = interpolate(charFrame, [0, 5], [0, 1], {
              extrapolateRight: "clamp",
            });

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  transform: `translateY(${y}px)`,
                  opacity,
                }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            );
          })}
        </span>
      );
    }

    // NEW: Gradient sweep reveal
    case "gradient": {
      const sweepPosition = interpolate(adjustedFrame, [0, 35], [-50, 150], {
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.ease),
      });

      const finalColor = gradientColors ? gradientColors[1] : color;

      // Clipping reveal effect
      const clipProgress = interpolate(adjustedFrame, [0, 30], [0, 100], {
        extrapolateRight: "clamp",
        easing,
      });

      return (
        <span style={{ ...baseStyle, position: "relative" }}>
          {/* Background text (revealed) */}
          <span
            style={{
              color: finalColor,
              clipPath: `inset(0 ${100 - clipProgress}% 0 0)`,
            }}
          >
            {text}
          </span>
          {/* Gradient highlight overlay */}
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              background: `linear-gradient(90deg, transparent ${sweepPosition - 30}%, ${color} ${sweepPosition}%, transparent ${sweepPosition + 30}%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              opacity: adjustedFrame < 35 ? 1 : 0,
            }}
          >
            {text}
          </span>
        </span>
      );
    }

    // NEW: Split animation (characters from random positions)
    case "split": {
      const chars = text.split("");
      // Deterministic "random" positions based on char index
      const getRandomOffset = (index: number) => ({
        x: Math.sin(index * 1.5) * 100,
        y: Math.cos(index * 2.1) * 60,
        rotation: Math.sin(index * 0.8) * 45,
      });

      return (
        <span style={baseStyle}>
          {chars.map((char, i) => {
            const charDelay = i * 1.5;
            const charFrame = Math.max(0, adjustedFrame - charDelay);
            const offset = getRandomOffset(i);

            const progress = spring({
              frame: charFrame,
              fps,
              config: { damping: 15, stiffness: 100 },
            });

            const x = interpolate(progress, [0, 1], [offset.x, 0]);
            const y = interpolate(progress, [0, 1], [offset.y, 0]);
            const rotation = interpolate(progress, [0, 1], [offset.rotation, 0]);
            const opacity = interpolate(charFrame, [0, 8], [0, 1], {
              extrapolateRight: "clamp",
            });
            const scale = interpolate(progress, [0, 1], [0.5, 1]);

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`,
                  opacity,
                }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            );
          })}
        </span>
      );
    }

    // NEW: Clip reveal (text revealed by expanding rectangle)
    case "reveal": {
      const revealProgress = interpolate(adjustedFrame, [0, 25], [0, 100], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.ease),
      });

      return (
        <span
          style={{
            ...baseStyle,
            clipPath: `inset(0 ${100 - revealProgress}% 0 0)`,
          }}
        >
          {text}
        </span>
      );
    }

    default:
      return <span style={baseStyle}>{text}</span>;
  }
};

// Multi-line animated text with staggered animations
interface AnimatedLinesProps {
  lines: string[];
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  staggerDelay?: number;
  animation?: AnimationType;
  easingPreset?: EasingPreset;
  style?: React.CSSProperties;
}

export const AnimatedLines: React.FC<AnimatedLinesProps> = ({
  lines,
  color = "#ffffff",
  fontSize = 24,
  fontFamily = "Inter, system-ui",
  lineHeight = 1.4,
  staggerDelay = 10,
  animation = "slide",
  easingPreset = "ease",
  style = {},
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: fontSize * (lineHeight - 1),
        ...style,
      }}
    >
      {lines.map((line, index) => (
        <AnimatedText
          key={index}
          text={line}
          color={color}
          fontSize={fontSize}
          fontFamily={fontFamily}
          delay={index * staggerDelay}
          animation={animation}
          easingPreset={easingPreset}
        />
      ))}
    </div>
  );
};

// NEW: Highlighted text with animated underline
interface HighlightedTextProps {
  text: string;
  highlightColor?: string;
  textColor?: string;
  fontSize?: number;
  delay?: number;
  underline?: boolean;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  highlightColor = "#8b5cf6",
  textColor = "#ffffff",
  fontSize = 24,
  delay = 0,
  underline = true,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const textOpacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const underlineWidth = interpolate(adjustedFrame, [10, 30], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        color: textColor,
        fontSize,
        fontWeight: 600,
        opacity: textOpacity,
      }}
    >
      {text}
      {underline && (
        <span
          style={{
            position: "absolute",
            bottom: -4,
            left: 0,
            height: 3,
            width: `${underlineWidth}%`,
            backgroundColor: highlightColor,
            borderRadius: 2,
          }}
        />
      )}
    </span>
  );
};

// NEW: Gradient text component
interface GradientTextProps {
  text: string;
  colors: [string, string];
  fontSize?: number;
  fontWeight?: number;
  delay?: number;
  animateGradient?: boolean;
}

export const GradientText: React.FC<GradientTextProps> = ({
  text,
  colors,
  fontSize = 32,
  fontWeight = 700,
  delay = 0,
  animateGradient = true,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Animated gradient position
  const gradientOffset = animateGradient
    ? interpolate(adjustedFrame, [0, 60], [0, 100], {
        extrapolateRight: "extend",
      }) % 200
    : 0;

  return (
    <span
      style={{
        fontSize,
        fontWeight,
        opacity,
        background: `linear-gradient(90deg, ${colors[0]} ${gradientOffset}%, ${colors[1]} ${gradientOffset + 50}%, ${colors[0]} ${gradientOffset + 100}%)`,
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      {text}
    </span>
  );
};
