import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

interface AnimatedTextProps {
  text: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  delay?: number;
  animation?: "spring" | "fade" | "typewriter" | "slide";
  slideDirection?: "up" | "down" | "left" | "right";
  style?: React.CSSProperties;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  color = "#ffffff",
  fontSize = 32,
  fontFamily = "Inter, system-ui",
  fontWeight = 600,
  delay = 0,
  animation = "spring",
  slideDirection = "up",
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  let opacity = 1;
  let transform = "none";

  switch (animation) {
    case "spring": {
      const scale = spring({
        frame: adjustedFrame,
        fps,
        config: { damping: 80, stiffness: 200 },
      });
      opacity = Math.min(1, adjustedFrame / 10);
      transform = `scale(${scale})`;
      break;
    }
    case "fade": {
      opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
      });
      break;
    }
    case "typewriter": {
      const charsToShow = Math.floor(adjustedFrame / 2);
      return (
        <span
          style={{
            color,
            fontSize,
            fontFamily,
            fontWeight,
            ...style,
          }}
        >
          {text.slice(0, charsToShow)}
          {charsToShow < text.length && (
            <span style={{ opacity: frame % 10 < 5 ? 1 : 0 }}>|</span>
          )}
        </span>
      );
    }
    case "slide": {
      const offset = {
        up: [30, 0],
        down: [-30, 0],
        left: [0, 30],
        right: [0, -30],
      }[slideDirection];

      const translateY = interpolate(
        adjustedFrame,
        [0, 20],
        [offset[0], 0],
        { extrapolateRight: "clamp" }
      );
      const translateX = interpolate(
        adjustedFrame,
        [0, 20],
        [offset[1], 0],
        { extrapolateRight: "clamp" }
      );
      opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
      });
      transform = `translate(${translateX}px, ${translateY}px)`;
      break;
    }
  }

  return (
    <span
      style={{
        color,
        fontSize,
        fontFamily,
        fontWeight,
        opacity,
        transform,
        display: "inline-block",
        ...style,
      }}
    >
      {text}
    </span>
  );
};

// Multi-line animated text with staggered animations
interface AnimatedLinesProps {
  lines: string[];
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  staggerDelay?: number;
  animation?: "spring" | "fade" | "slide";
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
        />
      ))}
    </div>
  );
};
