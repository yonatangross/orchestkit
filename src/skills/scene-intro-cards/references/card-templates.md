# Card Templates

React/Remotion component templates for scene intro cards.

## Base IntroCard Component

```tsx
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";

interface IntroCardProps {
  label?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  style?: "minimal" | "bold" | "branded" | "progress";
  primaryColor?: string;
  progress?: { current: number; total: number };
}

export const IntroCard: React.FC<IntroCardProps> = ({
  label = "COMING UP",
  title,
  subtitle,
  icon,
  style = "bold",
  primaryColor = "#8b5cf6",
  progress,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entry animations (first 15 frames)
  const entryProgress = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  // Exit animation (last 15 frames)
  const exitFrame = Math.max(0, frame - (durationInFrames - 15));
  const exitOpacity = interpolate(exitFrame, [0, 15], [1, 0], {
    extrapolateRight: "clamp",
  });

  const opacity = Math.min(entryProgress, exitOpacity);
  const scale = interpolate(entryProgress, [0, 1], [0.95, 1]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0a0a0f",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {style === "minimal" && (
        <MinimalCard
          label={label}
          title={title}
          primaryColor={primaryColor}
          frame={frame}
          fps={fps}
        />
      )}
      {style === "bold" && (
        <BoldCard
          label={label}
          title={title}
          subtitle={subtitle}
          icon={icon}
          primaryColor={primaryColor}
          frame={frame}
          fps={fps}
        />
      )}
      {style === "branded" && (
        <BrandedCard
          label={label}
          title={title}
          subtitle={subtitle}
          primaryColor={primaryColor}
          progress={progress}
          frame={frame}
          fps={fps}
        />
      )}
      {style === "progress" && (
        <ProgressCard
          title={title}
          primaryColor={primaryColor}
          progress={progress!}
          frame={frame}
          fps={fps}
        />
      )}
    </AbsoluteFill>
  );
};
```

## Minimal Card Template

```tsx
interface MinimalCardProps {
  label: string;
  title: string;
  primaryColor: string;
  frame: number;
  fps: number;
}

const MinimalCard: React.FC<MinimalCardProps> = ({
  label,
  title,
  primaryColor,
  frame,
  fps,
}) => {
  // Staggered entry
  const labelOpacity = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 300 },
  });

  const titleOpacity = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 80, stiffness: 250 },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Label */}
      <div
        style={{
          opacity: labelOpacity,
          fontSize: 14,
          fontFamily: "Inter, system-ui",
          fontWeight: 500,
          letterSpacing: "0.2em",
          color: primaryColor,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          fontSize: 42,
          fontFamily: "Inter, system-ui",
          fontWeight: 700,
          color: "white",
        }}
      >
        {title}
      </div>
    </div>
  );
};
```

## Bold Card Template

```tsx
interface BoldCardProps {
  label: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  primaryColor: string;
  frame: number;
  fps: number;
}

const BoldCard: React.FC<BoldCardProps> = ({
  label,
  title,
  subtitle,
  icon,
  primaryColor,
  frame,
  fps,
}) => {
  // Staggered animations
  const iconScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const labelOpacity = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 80, stiffness: 250 },
  });

  const titleY = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 20, stiffness: 100 },
    from: 20,
    to: 0,
  });

  const titleOpacity = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  const subtitleOpacity = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  // Subtle background pulse
  const bgPulse = 1 + Math.sin(frame * 0.05) * 0.02;

  return (
    <>
      {/* Radial gradient background */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${primaryColor}20 0%, transparent 70%)`,
          transform: `scale(${bgPulse})`,
        }}
      />

      {/* Card container */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          padding: 40,
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: 24,
          border: `1px solid ${primaryColor}30`,
        }}
      >
        {/* Icon */}
        {icon && (
          <div
            style={{
              transform: `scale(${iconScale})`,
              width: 80,
              height: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${primaryColor}20`,
              borderRadius: 20,
              color: primaryColor,
              fontSize: 40,
            }}
          >
            {icon}
          </div>
        )}

        {/* Label */}
        <div
          style={{
            opacity: labelOpacity,
            fontSize: 12,
            fontFamily: "Menlo, monospace",
            letterSpacing: "0.25em",
            color: "#6b7280",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>

        {/* Title */}
        <div
          style={{
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
            fontSize: 52,
            fontFamily: "Inter, system-ui",
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            maxWidth: 700,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              opacity: subtitleOpacity,
              fontSize: 18,
              fontFamily: "Inter, system-ui",
              fontWeight: 400,
              color: "#9ca3af",
              textAlign: "center",
              maxWidth: 500,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </>
  );
};
```

## Branded Card Template

```tsx
interface BrandedCardProps {
  label: string;
  title: string;
  subtitle?: string;
  primaryColor: string;
  progress?: { current: number; total: number };
  frame: number;
  fps: number;
}

const BrandedCard: React.FC<BrandedCardProps> = ({
  label,
  title,
  subtitle,
  primaryColor,
  progress,
  frame,
  fps,
}) => {
  // Accent bar animation
  const barWidth = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
    from: 0,
    to: 100,
  });

  const contentOpacity = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 24,
        padding: 60,
        width: "100%",
        maxWidth: 800,
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          height: 4,
          width: `${barWidth}%`,
          backgroundColor: primaryColor,
          borderRadius: 2,
        }}
      />

      {/* Progress indicator */}
      {progress && (
        <div
          style={{
            opacity: contentOpacity,
            fontSize: 14,
            fontFamily: "Menlo, monospace",
            color: "#6b7280",
          }}
        >
          Section {progress.current} of {progress.total}
        </div>
      )}

      {/* Label */}
      <div
        style={{
          opacity: contentOpacity,
          fontSize: 14,
          fontFamily: "Inter, system-ui",
          fontWeight: 500,
          letterSpacing: "0.15em",
          color: primaryColor,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      {/* Title */}
      <div
        style={{
          opacity: contentOpacity,
          fontSize: 56,
          fontFamily: "Inter, system-ui",
          fontWeight: 700,
          color: "white",
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div
          style={{
            opacity: contentOpacity * 0.8,
            fontSize: 20,
            fontFamily: "Inter, system-ui",
            fontWeight: 400,
            color: "#9ca3af",
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};
```

## Progress Card Template

```tsx
interface ProgressCardProps {
  title: string;
  primaryColor: string;
  progress: { current: number; total: number };
  frame: number;
  fps: number;
}

const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  primaryColor,
  progress,
  frame,
  fps,
}) => {
  // Dot animations
  const dots = Array.from({ length: progress.total }, (_, i) => {
    const isActive = i + 1 === progress.current;
    const isPast = i + 1 < progress.current;

    const dotScale = spring({
      frame: Math.max(0, frame - i * 3),
      fps,
      config: { damping: 15, stiffness: 150 },
    });

    return {
      scale: dotScale,
      isActive,
      isPast,
    };
  });

  const titleOpacity = spring({
    frame: Math.max(0, frame - progress.total * 3),
    fps,
    config: { damping: 80, stiffness: 200 },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
      }}
    >
      {/* Progress dots */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        {dots.map((dot, i) => (
          <div
            key={i}
            style={{
              transform: `scale(${dot.scale})`,
              width: dot.isActive ? 16 : 12,
              height: dot.isActive ? 16 : 12,
              borderRadius: "50%",
              backgroundColor: dot.isActive
                ? primaryColor
                : dot.isPast
                ? `${primaryColor}60`
                : "rgba(255,255,255,0.2)",
              border: dot.isActive
                ? `2px solid ${primaryColor}`
                : "2px solid transparent",
              boxShadow: dot.isActive
                ? `0 0 20px ${primaryColor}60`
                : "none",
            }}
          />
        ))}
      </div>

      {/* Step label */}
      <div
        style={{
          opacity: titleOpacity,
          fontSize: 14,
          fontFamily: "Menlo, monospace",
          letterSpacing: "0.2em",
          color: "#6b7280",
          textTransform: "uppercase",
        }}
      >
        Step {progress.current}
      </div>

      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          fontSize: 48,
          fontFamily: "Inter, system-ui",
          fontWeight: 700,
          color: "white",
          textAlign: "center",
        }}
      >
        {title}
      </div>
    </div>
  );
};
```

## Usage Examples

### Basic Usage

```tsx
<IntroCard
  label="COMING UP"
  title="The Problem"
  style="minimal"
  primaryColor="#8b5cf6"
/>
```

### With Icon (Bold Style)

```tsx
<IntroCard
  label="NEXT"
  title="Implementation"
  subtitle="Building the solution step by step"
  icon={<CodeIcon />}
  style="bold"
  primaryColor="#10b981"
/>
```

### With Progress (Branded Style)

```tsx
<IntroCard
  label="CHAPTER"
  title="Testing"
  style="branded"
  primaryColor="#f59e0b"
  progress={{ current: 3, total: 5 }}
/>
```

### Progress Dots Style

```tsx
<IntroCard
  title="Configure Settings"
  style="progress"
  primaryColor="#3b82f6"
  progress={{ current: 2, total: 4 }}
/>
```

## TransitionSeries Integration

```tsx
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

const FPS = 30;
const INTRO_CARD_DURATION = 2.5 * FPS; // 75 frames = 2.5s

export const VideoWithIntroCards: React.FC = () => {
  return (
    <TransitionSeries>
      {/* Hook Scene */}
      <TransitionSeries.Sequence durationInFrames={3 * FPS}>
        <HookScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        timing={linearTiming({ durationInFrames: 15 })}
        presentation={fade()}
      />

      {/* Intro Card: Problem */}
      <TransitionSeries.Sequence durationInFrames={INTRO_CARD_DURATION}>
        <IntroCard
          label="COMING UP"
          title="The Problem"
          style="bold"
          primaryColor="#ef4444"
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        timing={linearTiming({ durationInFrames: 15 })}
        presentation={fade()}
      />

      {/* Problem Scene */}
      <TransitionSeries.Sequence durationInFrames={5 * FPS}>
        <ProblemScene />
      </TransitionSeries.Sequence>

      {/* ... more sequences */}
    </TransitionSeries>
  );
};
```

## Vertical Format Adjustments

```tsx
const VerticalIntroCard: React.FC<IntroCardProps> = (props) => {
  // Adjust font sizes and spacing for 9:16 format
  return (
    <IntroCard
      {...props}
      style={{
        ...props.style,
        // Override styles for vertical
        titleFontSize: 38, // Smaller for narrower viewport
        labelFontSize: 11,
        gap: 16,
        padding: 32,
      }}
    />
  );
};
```

## Icon Components

```tsx
// Common icons for intro cards
export const CodeIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
  </svg>
);

export const LightbulbIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
  </svg>
);

export const WarningIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
  </svg>
);

export const CheckIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);

export const PlayIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const RocketIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.5s4.5 2.04 4.5 10.5c0 2.49-1.04 5.57-1.6 7H9.1c-.56-1.43-1.6-4.51-1.6-7C7.5 4.54 12 2.5 12 2.5zm0 6a2 2 0 100 4 2 2 0 000-4zm-3.5 9c.83 1.2 1.5 2 1.5 3.5h4c0-1.5.67-2.3 1.5-3.5h-7z" />
  </svg>
);
```
