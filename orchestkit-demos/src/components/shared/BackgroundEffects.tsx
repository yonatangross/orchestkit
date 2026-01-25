import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
  random,
  spring,
} from "remotion";
// Note: @remotion/noise must be installed: npm i @remotion/noise
// Using simple noise function as fallback until package is installed
const noise2D = (seed: string, x: number, y: number): number => {
  // Simple deterministic noise based on seed and coordinates
  const hash = seed.charCodeAt(0) + x * 12.9898 + y * 78.233;
  return Math.sin(hash * 43758.5453) * 0.5;
};

// ============================================================================
// PARTICLE BACKGROUND (Noise-driven floating particles)
// ============================================================================

interface ParticleBackgroundProps {
  particleCount?: number;
  particleColor?: string;
  particleSize?: number;
  speed?: number;
  opacity?: number;
  blur?: number;
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  particleCount = 50,
  particleColor = "#8b5cf6",
  particleSize = 4,
  speed = 0.5,
  opacity = 0.6,
  blur = 0,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Generate particles with deterministic positions
  const particles = React.useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      baseX: (Math.sin(i * 1.3) * 0.5 + 0.5) * width,
      baseY: (Math.cos(i * 2.1) * 0.5 + 0.5) * height,
      size: particleSize * (0.5 + Math.sin(i * 0.7) * 0.5),
      speedMult: 0.5 + Math.cos(i * 1.1) * 0.5,
    }));
  }, [particleCount, width, height, particleSize]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {particles.map((particle) => {
        // Use noise for organic movement
        const time = frame * speed * 0.01 * particle.speedMult;
        const noiseX = noise2D("x" + particle.id, time, 0) * 100;
        const noiseY = noise2D("y" + particle.id, 0, time) * 100;

        // Vertical drift
        const drift = (frame * speed * 0.5) % height;

        const x = particle.baseX + noiseX;
        const y = (particle.baseY - drift + height) % height + noiseY;

        // Fade based on position
        const fadeY = Math.sin((y / height) * Math.PI);
        const particleOpacity = opacity * fadeY;

        return (
          <div
            key={particle.id}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              backgroundColor: particleColor,
              opacity: particleOpacity,
              filter: blur > 0 ? `blur(${blur}px)` : undefined,
              boxShadow: `0 0 ${particle.size * 2}px ${particleColor}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ============================================================================
// MESH GRADIENT (Animated multi-color gradient)
// ============================================================================

interface MeshGradientProps {
  colors?: string[];
  speed?: number;
  opacity?: number;
}

export const MeshGradient: React.FC<MeshGradientProps> = ({
  colors = ["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b"],
  speed = 1,
  opacity = 0.3,
}) => {
  const frame = useCurrentFrame();
  const time = frame * speed * 0.02;

  // Animate gradient positions
  const positions = colors.map((_, i) => {
    const angle = (i / colors.length) * Math.PI * 2 + time;
    const x = 50 + Math.cos(angle) * 30;
    const y = 50 + Math.sin(angle * 0.7) * 30;
    return { x, y };
  });

  // Build radial gradients
  const gradients = colors.map((color, i) => {
    const pos = positions[i];
    return `radial-gradient(ellipse at ${pos.x}% ${pos.y}%, ${color}60 0%, transparent 50%)`;
  }).join(", ");

  return (
    <AbsoluteFill
      style={{
        background: gradients,
        opacity,
      }}
    />
  );
};

// ============================================================================
// VIGNETTE (Edge darkening effect)
// ============================================================================

interface VignetteProps {
  intensity?: number;
  color?: string;
}

export const Vignette: React.FC<VignetteProps> = ({
  intensity = 0.5,
  color = "#000000",
}) => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, transparent 40%, ${color} 100%)`,
        opacity: intensity,
        pointerEvents: "none",
      }}
    />
  );
};

// ============================================================================
// GRID PATTERN (Animated grid lines)
// ============================================================================

interface GridPatternProps {
  gridSize?: number;
  lineColor?: string;
  lineWidth?: number;
  animated?: boolean;
  perspective?: boolean;
}

export const GridPattern: React.FC<GridPatternProps> = ({
  gridSize = 50,
  lineColor = "rgba(139, 92, 246, 0.15)",
  lineWidth = 1,
  animated = true,
  perspective = false,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const offset = animated ? (frame * 0.5) % gridSize : 0;

  // Generate grid lines
  const verticalLines = [];
  const horizontalLines = [];

  for (let x = -gridSize; x <= width + gridSize; x += gridSize) {
    verticalLines.push(
      <line
        key={`v-${x}`}
        x1={x + offset}
        y1={0}
        x2={x + offset}
        y2={height}
        stroke={lineColor}
        strokeWidth={lineWidth}
      />
    );
  }

  for (let y = -gridSize; y <= height + gridSize; y += gridSize) {
    horizontalLines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y + offset}
        x2={width}
        y2={y + offset}
        stroke={lineColor}
        strokeWidth={lineWidth}
      />
    );
  }

  const perspectiveStyle: React.CSSProperties = perspective
    ? {
        transform: "perspective(500px) rotateX(60deg)",
        transformOrigin: "center bottom",
      }
    : {};

  return (
    <AbsoluteFill style={perspectiveStyle}>
      <svg width={width} height={height}>
        {verticalLines}
        {horizontalLines}
      </svg>
    </AbsoluteFill>
  );
};

// ============================================================================
// GLOW ORBS (Large blurred color orbs)
// ============================================================================

interface GlowOrbsProps {
  orbs?: Array<{
    color: string;
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    size: number; // percentage of screen
  }>;
  animated?: boolean;
}

export const GlowOrbs: React.FC<GlowOrbsProps> = ({
  orbs = [
    { color: "#8b5cf6", x: 20, y: 30, size: 40 },
    { color: "#06b6d4", x: 80, y: 70, size: 35 },
    { color: "#22c55e", x: 50, y: 50, size: 30 },
  ],
  animated = true,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {orbs.map((orb, i) => {
        // Animate position slightly
        const time = frame * 0.01;
        const offsetX = animated ? Math.sin(time + i) * 5 : 0;
        const offsetY = animated ? Math.cos(time * 0.7 + i) * 5 : 0;

        // Pulse size
        const pulse = animated ? 1 + Math.sin(frame * 0.05 + i) * 0.05 : 1;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${orb.x + offsetX}%`,
              top: `${orb.y + offsetY}%`,
              width: `${orb.size * pulse}%`,
              aspectRatio: "1",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${orb.color}40 0%, transparent 70%)`,
              transform: "translate(-50%, -50%)",
              filter: "blur(40px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ============================================================================
// SCAN LINES (CRT/VHS effect)
// ============================================================================

interface ScanLinesProps {
  lineHeight?: number;
  opacity?: number;
  animated?: boolean;
}

export const ScanLines: React.FC<ScanLinesProps> = ({
  lineHeight = 2,
  opacity = 0.1,
  animated = false,
}) => {
  const frame = useCurrentFrame();
  const offset = animated ? (frame * 0.5) % (lineHeight * 2) : 0;

  return (
    <AbsoluteFill
      style={{
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent ${lineHeight}px,
          rgba(0, 0, 0, ${opacity}) ${lineHeight}px,
          rgba(0, 0, 0, ${opacity}) ${lineHeight * 2}px
        )`,
        backgroundPositionY: offset,
        pointerEvents: "none",
      }}
    />
  );
};

// ============================================================================
// NOISE TEXTURE (Film grain effect)
// ============================================================================

interface NoiseTextureProps {
  opacity?: number;
  animated?: boolean;
}

export const NoiseTexture: React.FC<NoiseTextureProps> = ({
  opacity = 0.05,
  animated = true,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Canvas-based noise for performance
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Use deterministic random based on pixel position and frame
      const noise = random(`noise-${i}-${animated ? frame : 0}`) * 255;
      imageData.data[i] = noise;
      imageData.data[i + 1] = noise;
      imageData.data[i + 2] = noise;
      imageData.data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }, [frame, width, height, animated]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", opacity }}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// AURORA BACKGROUND (AnimStats-style hue-rotating gradient)
// ============================================================================

interface AuroraBackgroundProps {
  colors?: string[];
  speed?: number;
  opacity?: number;
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({
  colors = ["#8b5cf6", "#06b6d4", "#22c55e"],
  speed = 1,
  opacity = 0.4,
}) => {
  const frame = useCurrentFrame();

  // Hue rotation for color shifting (0 to 360 degrees over ~5 seconds at 30fps)
  const hueRotate = interpolate(frame, [0, 150], [0, 360], {
    extrapolateRight: "extend",
  }) * speed;

  // Moving blob positions
  const time = frame * 0.015 * speed;

  const blobs = colors.map((color, i) => {
    const angle = (i / colors.length) * Math.PI * 2;
    const x = 50 + Math.cos(angle + time) * 25;
    const y = 50 + Math.sin(angle * 0.8 + time * 0.7) * 25;
    const scale = 1 + Math.sin(time + i) * 0.2;
    return { color, x, y, scale };
  });

  return (
    <AbsoluteFill
      style={{
        filter: `hue-rotate(${hueRotate}deg) saturate(1.2)`,
        opacity,
      }}
    >
      {blobs.map((blob, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${blob.x}%`,
            top: `${blob.y}%`,
            width: `${60 * blob.scale}%`,
            height: `${60 * blob.scale}%`,
            background: `radial-gradient(circle, ${blob.color}80 0%, ${blob.color}40 30%, transparent 70%)`,
            transform: "translate(-50%, -50%)",
            filter: "blur(60px)",
            mixBlendMode: "screen",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ============================================================================
// CONFETTI BURST (Particle explosion for celebrations)
// ============================================================================

interface ConfettiBurstProps {
  startFrame: number;
  particleCount?: number;
  colors?: string[];
  duration?: number;
  origin?: { x: number; y: number }; // percentage
}

export const ConfettiBurst: React.FC<ConfettiBurstProps> = ({
  startFrame,
  particleCount = 50,
  colors = ["#8b5cf6", "#22c55e", "#06b6d4", "#f59e0b", "#ec4899"],
  duration = 60,
  origin = { x: 50, y: 50 },
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Generate particles with deterministic properties (must be before early return)
  const particles = React.useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      const angle = (i / particleCount) * Math.PI * 2 + Math.sin(i * 0.5) * 0.5;
      const velocity = 200 + Math.sin(i * 1.3) * 100;
      const rotationSpeed = (Math.sin(i * 2.1) - 0.5) * 720;
      const size = 8 + Math.sin(i * 0.7) * 6;
      const color = colors[i % colors.length];
      const shape = i % 3; // 0=square, 1=circle, 2=triangle

      return { angle, velocity, rotationSpeed, size, color, shape };
    });
  }, [particleCount, colors]);

  const relativeFrame = frame - startFrame;

  if (relativeFrame < 0 || relativeFrame > duration) {
    return null;
  }

  const progress = relativeFrame / duration;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {particles.map((particle, i) => {
        // Physics: position with gravity
        const gravity = 400;
        const t = relativeFrame / fps;

        const vx = Math.cos(particle.angle) * particle.velocity;
        const vy = Math.sin(particle.angle) * particle.velocity - gravity * t;

        const x = origin.x + (vx * t * 0.1);
        const y = origin.y - (vy * t * 0.1) + (gravity * t * t * 0.05);

        const rotation = particle.rotationSpeed * t;

        // Fade out
        const opacity = interpolate(progress, [0.6, 1], [1, 0], {
          extrapolateLeft: "clamp",
        });

        // Scale down at end
        const scale = interpolate(progress, [0, 0.1, 0.8, 1], [0, 1, 1, 0.5], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const shapeStyle: React.CSSProperties = {
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: particle.size * scale,
          height: particle.size * scale,
          backgroundColor: particle.color,
          opacity,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          borderRadius: particle.shape === 1 ? "50%" : particle.shape === 2 ? "0" : "2px",
        };

        // Triangle shape using clip-path
        if (particle.shape === 2) {
          shapeStyle.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
        }

        return <div key={i} style={shapeStyle} />;
      })}
    </AbsoluteFill>
  );
};

// ============================================================================
// SUCCESS CHECKMARK (Animated checkmark pop)
// ============================================================================

interface SuccessCheckmarkProps {
  startFrame: number;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const SuccessCheckmark: React.FC<SuccessCheckmarkProps> = ({
  startFrame,
  size = 40,
  color = "#22c55e",
  strokeWidth = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relativeFrame = frame - startFrame;

  if (relativeFrame < 0) {
    return null;
  }

  // Pop scale with spring
  const scale = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  // Draw checkmark path
  const pathLength = 30;
  const drawProgress = interpolate(relativeFrame, [5, 20], [0, pathLength], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        transform: `scale(${scale})`,
        filter: `drop-shadow(0 0 10px ${color}80)`,
      }}
    >
      {/* Circle background */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={`${color}20`}
        stroke={color}
        strokeWidth={strokeWidth / 2}
      />
      {/* Checkmark */}
      <path
        d="M6 12l4 4 8-8"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={pathLength - drawProgress}
      />
    </svg>
  );
};

// ============================================================================
// ANIMATED BAR CHART (Elastic growing bars)
// ============================================================================

interface BarData {
  value: number;
  label: string;
  color: string;
}

interface AnimatedBarChartProps {
  data: BarData[];
  startFrame?: number;
  barHeight?: number;
  maxWidth?: number;
  staggerDelay?: number;
  showValues?: boolean;
  showLabels?: boolean;
}

export const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({
  data,
  startFrame = 0,
  barHeight = 32,
  maxWidth = 400,
  staggerDelay = 4,
  showValues = true,
  showLabels = true,
}) => {
  const frame = useCurrentFrame();

  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((bar, i) => {
        const delay = startFrame + i * staggerDelay;
        const relativeFrame = frame - delay;

        // Elastic easing for bounce effect
        const progress = interpolate(
          relativeFrame,
          [0, 30],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.elastic(1)),
          }
        );

        const barWidth = (bar.value / maxValue) * maxWidth * progress;
        const opacity = interpolate(relativeFrame, [0, 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity,
            }}
          >
            {showLabels && (
              <span
                style={{
                  width: 80,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "Inter, system-ui",
                  textAlign: "right",
                }}
              >
                {bar.label}
              </span>
            )}
            <div
              style={{
                height: barHeight,
                width: barWidth,
                backgroundColor: bar.color,
                borderRadius: barHeight / 2,
                boxShadow: `0 0 20px ${bar.color}40`,
                position: "relative",
              }}
            >
              {showValues && progress > 0.5 && (
                <span
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "white",
                    fontFamily: "Inter, system-ui",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(bar.value * progress)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// GRADIENT WIPE (Animated gradient transition)
// ============================================================================

interface GradientWipeProps {
  colors: [string, string];
  direction?: "horizontal" | "vertical" | "diagonal";
  progress?: number; // 0-1 override, otherwise uses frame
  duration?: number; // frames
  delay?: number;
}

export const GradientWipe: React.FC<GradientWipeProps> = ({
  colors,
  direction = "horizontal",
  progress: progressOverride,
  duration = 30,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const progress =
    progressOverride ??
    interpolate(adjustedFrame, [0, duration], [0, 1], {
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease),
    });

  const gradientAngle =
    direction === "horizontal"
      ? "90deg"
      : direction === "vertical"
        ? "180deg"
        : "135deg";

  const gradientPosition = progress * 200 - 50;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${gradientAngle}, ${colors[0]} ${gradientPosition - 25}%, ${colors[1]} ${gradientPosition}%, ${colors[0]} ${gradientPosition + 25}%)`,
      }}
    />
  );
};
