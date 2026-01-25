import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";
import { z } from "zod";

// Import shared components
import {
  MeshGradient,
  ParticleBackground,
  Vignette,
  AuroraBackground,
  NoiseTexture,
  ConfettiBurst,
  SuccessCheckmark,
  AnimatedBarChart,
} from "./shared/BackgroundEffects";
import { SceneTransition } from "./shared/TransitionWipe";

/**
 * MarketplaceIntro - 30-second cinematic marketplace showcase
 *
 * Redesigned Timeline:
 * 0-4s:    Clean logo reveal (no cheap orbiting rings)
 * 4-9s:    Stats with clean counters (no digit morph)
 * 9-15s:   3 featured commands with numbers
 * 15-22s:  Full-screen command grid (all 23 commands)
 * 22-27s:  Benefits comparison
 * 27-30s:  CTA
 */

export const marketplaceIntroSchema = z.object({
  primaryColor: z.string().default("#8b5cf6"),
  secondaryColor: z.string().default("#22c55e"),
  accentColor: z.string().default("#06b6d4"),
});

type MarketplaceIntroProps = z.infer<typeof marketplaceIntroSchema>;

// All 23 commands with descriptions
const ALL_COMMANDS = [
  { cmd: "/explore", desc: "Understand any codebase" },
  { cmd: "/implement", desc: "Build features with agents" },
  { cmd: "/verify", desc: "6 agents validate features" },
  { cmd: "/review-pr", desc: "Expert code review" },
  { cmd: "/commit", desc: "Conventional commits" },
  { cmd: "/create-pr", desc: "Auto-generate PRs" },
  { cmd: "/fix-issue", desc: "Debug intelligently" },
  { cmd: "/run-tests", desc: "Parallel test execution" },
  { cmd: "/brainstorming", desc: "Think before coding" },
  { cmd: "/remember", desc: "Teach Claude patterns" },
  { cmd: "/recall", desc: "Retrieve decisions" },
  { cmd: "/best-practices", desc: "View your standards" },
  { cmd: "/configure", desc: "Setup wizard" },
  { cmd: "/doctor", desc: "Health diagnostics" },
  { cmd: "/assess-complexity", desc: "Task analysis" },
  { cmd: "/quality-gates", desc: "Validation checks" },
  { cmd: "/release-management", desc: "Version control" },
  { cmd: "/github-operations", desc: "GitHub CLI ops" },
  { cmd: "/stacked-prs", desc: "Multi-PR workflow" },
  { cmd: "/errors", desc: "Pattern analysis" },
  { cmd: "/feedback", desc: "Learning system" },
  { cmd: "/load-context", desc: "Auto-load memories" },
  { cmd: "/add-golden", desc: "Dataset curation" },
];

// Featured commands (top 3)
const FEATURED_COMMANDS = ALL_COMMANDS.slice(0, 3);

export const MarketplaceIntro: React.FC<MarketplaceIntroProps> = ({
  primaryColor,
  secondaryColor,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Scene boundaries (in frames)
  const SCENE_1_END = fps * 4;    // Logo
  const SCENE_2_END = fps * 9;    // Stats
  const SCENE_3_END = fps * 15;   // Featured commands
  const SCENE_4_END = fps * 22;   // Full command grid
  const SCENE_5_END = fps * 27;   // Benefits
  // Scene 6: CTA (27-30s)

  const progress = frame / durationInFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* ==================== BACKGROUND (AnimStats Aurora) ==================== */}
      <AuroraBackground
        colors={[primaryColor, secondaryColor, accentColor]}
        speed={0.8}
        opacity={0.35}
      />
      <MeshGradient
        colors={[primaryColor, secondaryColor, accentColor]}
        speed={0.5}
        opacity={0.08}
      />
      <ParticleBackground
        particleCount={30}
        particleColor={primaryColor}
        opacity={0.35}
        speed={0.3}
      />

      {/* ==================== SCENE 1: Logo (0-4s) ==================== */}
      <Sequence durationInFrames={SCENE_1_END}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Clean logo reveal */}
          <LogoReveal
            frame={frame}
            fps={fps}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            accentColor={accentColor}
          />
        </AbsoluteFill>
        <SceneTransition
          type="fade"
          color="#0a0a0f"
          startFrame={SCENE_1_END - 15}
          durationFrames={15}
        />
      </Sequence>

      {/* ==================== SCENE 2: Stats (4-9s) ==================== */}
      <Sequence from={SCENE_1_END} durationInFrames={SCENE_2_END - SCENE_1_END}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <StatsScene
            frame={frame - SCENE_1_END}
            fps={fps}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            accentColor={accentColor}
          />
        </AbsoluteFill>
        <SceneTransition
          type="wipe"
          color="#0a0a0f"
          startFrame={SCENE_2_END - SCENE_1_END - 12}
          durationFrames={12}
        />
      </Sequence>

      {/* ==================== SCENE 3: Featured Commands (9-15s) ==================== */}
      <Sequence from={SCENE_2_END} durationInFrames={SCENE_3_END - SCENE_2_END}>
        <AbsoluteFill>
          <FeaturedCommandsScene
            frame={frame - SCENE_2_END}
            fps={fps}
            primaryColor={primaryColor}
            commands={FEATURED_COMMANDS}
          />
        </AbsoluteFill>
        <SceneTransition
          type="zoom"
          color="#0a0a0f"
          startFrame={SCENE_3_END - SCENE_2_END - 10}
          durationFrames={10}
        />
      </Sequence>

      {/* ==================== SCENE 4: Full Command Grid (15-22s) ==================== */}
      <Sequence from={SCENE_3_END} durationInFrames={SCENE_4_END - SCENE_3_END}>
        <AbsoluteFill>
          <FullCommandGridScene
            frame={frame - SCENE_3_END}
            fps={fps}
            primaryColor={primaryColor}
            commands={ALL_COMMANDS}
          />
        </AbsoluteFill>
        <SceneTransition
          type="fade"
          color="#0a0a0f"
          startFrame={SCENE_4_END - SCENE_3_END - 12}
          durationFrames={12}
        />
      </Sequence>

      {/* ==================== SCENE 5: Benefits (22-27s) ==================== */}
      <Sequence from={SCENE_4_END} durationInFrames={SCENE_5_END - SCENE_4_END}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <BenefitsScene
            frame={frame - SCENE_4_END}
            fps={fps}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
          />
        </AbsoluteFill>
        <SceneTransition
          type="fade"
          color="#0a0a0f"
          startFrame={SCENE_5_END - SCENE_4_END - 10}
          durationFrames={10}
        />
      </Sequence>

      {/* ==================== SCENE 6: CTA (27-30s) ==================== */}
      <Sequence from={SCENE_5_END}>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <CTAScene
            frame={frame - SCENE_5_END}
            fps={fps}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ==================== OVERLAYS (AnimStats Polish) ==================== */}
      <Vignette intensity={0.4} />
      {/* Film grain texture for premium feel */}
      <NoiseTexture opacity={0.035} animated />
      {/* Confetti burst on CTA */}
      <ConfettiBurst
        startFrame={fps * 27 + 10}
        particleCount={60}
        colors={[primaryColor, secondaryColor, accentColor, "#f59e0b", "#ec4899"]}
        duration={50}
        origin={{ x: 50, y: 45 }}
      />

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE COMPONENTS
// ============================================================================

interface SceneProps {
  frame: number;
  fps: number;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
}

// Clean Logo Reveal (no orbiting rings)
const LogoReveal: React.FC<SceneProps> = ({
  frame,
  fps,
  primaryColor,
  secondaryColor,
  accentColor,
}) => {
  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeOpacity = interpolate(frame, [70, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {/* Main logo */}
      <h1
        style={{
          fontSize: 120,
          fontWeight: 800,
          fontFamily: "Inter, system-ui",
          margin: 0,
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 50%, ${accentColor} 100%)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.03em",
          textShadow: `0 0 80px ${primaryColor}40`,
        }}
      >
        OrchestKit
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: 28,
          color: "rgba(255,255,255,0.8)",
          fontFamily: "Inter, system-ui",
          fontWeight: 400,
          margin: 0,
          opacity: taglineOpacity,
          letterSpacing: "0.02em",
        }}
      >
        AI-Powered Development Toolkit
      </p>

      {/* CC Badge */}
      <span
        style={{
          fontSize: 13,
          color: accentColor,
          fontFamily: "Menlo, monospace",
          padding: "8px 20px",
          backgroundColor: `${accentColor}12`,
          borderRadius: 24,
          border: `1px solid ${accentColor}25`,
          opacity: badgeOpacity,
          marginTop: 8,
        }}
      >
        Claude Code 2.1.16
      </span>
    </div>
  );
};

// AnimStats-style Stats Scene with glassmorphism, bar chart, and checkmarks
const StatsScene: React.FC<SceneProps> = ({
  frame,
  fps,
  primaryColor,
  secondaryColor,
  accentColor,
}) => {
  const stats = [
    { value: 23, label: "Commands", color: primaryColor! },
    { value: 169, label: "Skills", color: secondaryColor! },
    { value: 35, label: "Agents", color: accentColor! },
    { value: 148, label: "Hooks", color: "#f59e0b" },
  ];

  // Card entrance with spring overshoot (AnimStats pop)
  const cardScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 200, mass: 1 },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
      }}
    >
      {/* Title with slide-in */}
      <h2
        style={{
          fontSize: 48,
          color: "white",
          fontFamily: "Inter, system-ui",
          fontWeight: 700,
          margin: 0,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [0, 20], [20, 0], { extrapolateRight: "clamp" })}px)`,
          letterSpacing: "-0.02em",
        }}
      >
        Everything You Need
      </h2>

      {/* AnimStats-style Glassmorphism card (BRIGHTER) */}
      <div
        style={{
          display: "flex",
          gap: 50,
          padding: "52px 80px",
          background: "rgba(255, 255, 255, 0.12)", // Brighter glass
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRadius: 32,
          border: "1px solid rgba(255, 255, 255, 0.25)", // Stronger border
          boxShadow: `
            0 10px 30px -5px rgba(0, 0, 0, 0.15),
            0 30px 60px -10px rgba(50, 50, 93, 0.2),
            inset 0 1px 1px rgba(255, 255, 255, 0.1)
          `, // Multi-layer shadow
          transform: `scale(${cardScale})`,
        }}
      >
        {stats.map((stat, i) => {
          const delay = 10 + i * 8;
          const statProgress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 12, stiffness: 180 },
          });

          // Counter animation over 50 frames
          const counterStart = delay + 5;
          const counterEnd = counterStart + 50;
          const countProgress = interpolate(frame, [counterStart, counterEnd], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const countValue = Math.round(stat.value * countProgress);
          const counterDone = frame > counterEnd;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                opacity: statProgress,
                transform: `scale(${0.8 + statProgress * 0.2}) translateY(${(1 - statProgress) * 25}px)`,
                minWidth: 130,
                position: "relative",
              }}
            >
              {/* Number with success checkmark */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 80,
                    fontWeight: 800,
                    color: stat.color,
                    fontFamily: "Inter, system-ui",
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                    textShadow: `0 0 60px ${stat.color}50`,
                  }}
                >
                  {countValue}
                </span>
                {/* Success checkmark after counter completes */}
                {counterDone && (
                  <SuccessCheckmark
                    startFrame={counterEnd}
                    size={28}
                    color={stat.color}
                    strokeWidth={3}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.65)",
                  fontFamily: "Inter, system-ui",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  fontWeight: 500,
                }}
              >
                {stat.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Animated Bar Chart (below stats) */}
      <div
        style={{
          opacity: interpolate(frame, [90, 110], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [90, 110], [20, 0], { extrapolateRight: "clamp" })}px)`,
        }}
      >
        <AnimatedBarChart
          data={stats.map((s) => ({ value: s.value, label: s.label, color: s.color }))}
          startFrame={95}
          barHeight={24}
          maxWidth={350}
          staggerDelay={5}
          showLabels
          showValues
        />
      </div>
    </div>
  );
};

// Featured Commands with Numbers (1, 2, 3) - AnimStats style with glassmorphism
const FeaturedCommandsScene: React.FC<SceneProps & { commands: typeof FEATURED_COMMANDS }> = ({
  frame,
  fps,
  primaryColor,
  commands,
}) => {
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 20], [20, 0], { extrapolateRight: "clamp" });

  // Card pop entrance
  const cardScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 200 },
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 40,
        padding: 80,
      }}
    >
      {/* Title with slide-in */}
      <h2
        style={{
          fontSize: 40,
          color: "white",
          fontFamily: "Inter, system-ui",
          fontWeight: 700,
          margin: 0,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          letterSpacing: "-0.02em",
        }}
      >
        Top Commands
      </h2>

      {/* AnimStats-style Glassmorphism card (BRIGHTER) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          padding: "44px 60px",
          background: "rgba(255, 255, 255, 0.10)", // Brighter
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRadius: 32,
          border: "1px solid rgba(255, 255, 255, 0.22)", // Stronger border glow
          boxShadow: `
            0 10px 30px -5px rgba(0, 0, 0, 0.12),
            0 30px 60px -10px rgba(50, 50, 93, 0.18),
            inset 0 1px 1px rgba(255, 255, 255, 0.08)
          `,
          transform: `scale(${cardScale})`,
          minWidth: 620,
        }}
      >
        {commands.map((cmd, i) => {
          const delay = 25 + i * 20;
          const cmdProgress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 12, stiffness: 180 },
          });

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                opacity: cmdProgress,
                transform: `translateX(${(1 - cmdProgress) * 60}px) scale(${0.9 + cmdProgress * 0.1})`,
              }}
            >
              {/* Number badge with glow */}
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${primaryColor}30, ${primaryColor}15)`,
                  border: `2px solid ${primaryColor}60`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: `0 0 30px ${primaryColor}30`,
                }}
              >
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: primaryColor,
                    fontFamily: "Inter, system-ui",
                  }}
                >
                  {i + 1}
                </span>
              </div>

              {/* Command */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <code
                  style={{
                    fontSize: 30,
                    color: "white",
                    fontFamily: "Menlo, monospace",
                    fontWeight: 600,
                  }}
                >
                  {cmd.cmd}
                </code>
                <span
                  style={{
                    fontSize: 16,
                    color: "rgba(255,255,255,0.55)",
                    fontFamily: "Inter, system-ui",
                  }}
                >
                  {cmd.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* "And 20 more..." teaser with pop */}
      <p
        style={{
          fontSize: 20,
          color: primaryColor,
          fontFamily: "Inter, system-ui",
          margin: 0,
          fontWeight: 500,
          opacity: interpolate(frame, [130, 150], [0, 1], { extrapolateRight: "clamp" }),
          transform: `scale(${interpolate(frame, [130, 150], [0.8, 1], { extrapolateRight: "clamp" })})`,
        }}
      >
        + 20 more commands →
      </p>
    </div>
  );
};

// Full Command Grid (all 23 commands) - 5 columns for better readability
const FullCommandGridScene: React.FC<SceneProps & { commands: typeof ALL_COMMANDS }> = ({
  frame,
  fps,
  primaryColor,
  commands,
}) => {
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  // Grid configuration: 5 columns (better balance of size and density)
  const COLUMNS = 5;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "50px 80px",
        gap: 24,
      }}
    >
      {/* Title */}
      <h2
        style={{
          fontSize: 36,
          color: "white",
          fontFamily: "Inter, system-ui",
          fontWeight: 600,
          margin: 0,
          textAlign: "center",
          opacity: titleOpacity,
        }}
      >
        All 23 Commands
      </h2>

      {/* Command grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
          gap: 14,
          flex: 1,
          alignContent: "center",
        }}
      >
        {commands.map((cmd, i) => {
          // Stagger by row then column
          const row = Math.floor(i / COLUMNS);
          const col = i % COLUMNS;
          const delay = 8 + row * 6 + col * 2;

          const itemProgress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 18, stiffness: 120 },
          });

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "16px 20px",
                backgroundColor: `${primaryColor}10`,
                borderRadius: 12,
                borderLeft: `4px solid ${primaryColor}80`,
                opacity: itemProgress,
                transform: `scale(${0.85 + itemProgress * 0.15})`,
              }}
            >
              <code
                style={{
                  fontSize: 18,
                  color: primaryColor,
                  fontFamily: "Menlo, monospace",
                  fontWeight: 600,
                }}
              >
                {cmd.cmd}
              </code>
              <span
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "Inter, system-ui",
                  lineHeight: 1.35,
                }}
              >
                {cmd.desc}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Benefits Scene
const BenefitsScene: React.FC<SceneProps> = ({
  frame,
  primaryColor,
  secondaryColor,
}) => {
  const beforeOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const arrowOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const afterOpacity = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: "clamp" });
  const textOpacity = interpolate(frame, [90, 110], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 60,
      }}
    >
      {/* Before / After */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 80,
        }}
      >
        {/* Before */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            opacity: beforeOpacity,
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: "#ef4444",
              fontFamily: "Menlo, monospace",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
            }}
          >
            Before
          </span>
          <div
            style={{
              padding: "40px 60px",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              borderRadius: 20,
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <span
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: "#ef4444",
                fontFamily: "Inter, system-ui",
              }}
            >
              4h
            </span>
          </div>
          <span
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.5)",
              fontFamily: "Inter, system-ui",
            }}
          >
            Hours of setup
          </span>
        </div>

        {/* Arrow */}
        <div
          style={{
            fontSize: 56,
            color: primaryColor,
            opacity: arrowOpacity,
          }}
        >
          →
        </div>

        {/* After */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            opacity: afterOpacity,
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: secondaryColor,
              fontFamily: "Menlo, monospace",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
            }}
          >
            After
          </span>
          <div
            style={{
              padding: "40px 60px",
              backgroundColor: `${secondaryColor}10`,
              borderRadius: 20,
              border: `1px solid ${secondaryColor}30`,
            }}
          >
            <span
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: secondaryColor,
                fontFamily: "Inter, system-ui",
              }}
            >
              1
            </span>
          </div>
          <span
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.5)",
              fontFamily: "Inter, system-ui",
            }}
          >
            Single command
          </span>
        </div>
      </div>

      {/* Tagline */}
      <p
        style={{
          fontSize: 28,
          color: "white",
          fontFamily: "Inter, system-ui",
          fontWeight: 500,
          margin: 0,
          opacity: textOpacity,
        }}
      >
        From hours to seconds. Every time.
      </p>
    </div>
  );
};

// CTA Scene - AnimStats style with spring pop and glow
const CTAScene: React.FC<SceneProps> = ({
  frame,
  fps,
  primaryColor,
  secondaryColor,
}) => {
  // Pop entrance with overshoot
  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 200, mass: 1 },
  });

  const subtitleOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });
  const subtitleY = interpolate(frame, [25, 45], [15, 0], { extrapolateRight: "clamp" });

  // Staggered pill entrance
  const pillsProgress = (i: number) => spring({
    frame: frame - 40 - i * 6,
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  // Subtle breathing animation at the end
  const breathe = frame > 60
    ? interpolate(frame, [60, 90], [1, 1.02], { extrapolateRight: "clamp" })
    : 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 36,
      }}
    >
      {/* Install command with glow */}
      <div
        style={{
          padding: "32px 64px",
          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
          borderRadius: 24,
          boxShadow: `
            0 0 60px ${primaryColor}60,
            0 25px 80px -10px ${primaryColor}50,
            inset 0 1px 1px rgba(255,255,255,0.2)
          `,
          transform: `scale(${scale * breathe})`,
          border: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        <code
          style={{
            fontSize: 52,
            color: "white",
            fontFamily: "Menlo, monospace",
            fontWeight: 700,
            textShadow: "0 2px 10px rgba(0,0,0,0.2)",
          }}
        >
          /plugin install ork
        </code>
      </div>

      {/* Subtitle with slide */}
      <p
        style={{
          fontSize: 26,
          color: "rgba(255,255,255,0.9)",
          fontFamily: "Inter, system-ui",
          margin: 0,
          fontWeight: 500,
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          letterSpacing: "-0.01em",
        }}
      >
        Start building smarter today
      </p>

      {/* Feature pills with stagger */}
      <div
        style={{
          display: "flex",
          gap: 14,
        }}
      >
        {["169 Skills", "35 Agents", "148 Hooks"].map((text, i) => {
          const pillProgress = pillsProgress(i);
          return (
            <span
              key={i}
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
                fontFamily: "Menlo, monospace",
                padding: "12px 24px",
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: 30,
                border: "1px solid rgba(255,255,255,0.1)",
                opacity: pillProgress,
                transform: `scale(${0.8 + pillProgress * 0.2}) translateY(${(1 - pillProgress) * 15}px)`,
              }}
            >
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
