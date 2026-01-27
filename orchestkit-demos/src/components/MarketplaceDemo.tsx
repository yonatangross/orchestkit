import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { z } from "zod";
import { ORCHESTKIT_STATS, COLORS } from "../constants";

// Import toy components
import {
  ToyToggle,
  ToyMindMap,
  ToyAgentFan,
  ToyCodeStream,
  ToyShield,
  ToyTrophy,
  ToyChecklist,
  ToyNetwork,
} from "./marketplace/toys";

// Import utilities
import { Camera } from "./marketplace/Camera";
import { MontageLabel } from "./marketplace/MontageLabel";
import { InfiniteMarquee } from "./marketplace/InfiniteMarquee";
import { SplitScene } from "./marketplace/SplitScene";
import { CompactTerminal, TERMINAL_CONFIGS } from "./marketplace/CompactTerminal";

/**
 * MarketplaceDemo v11 - "SIDE BY SIDE" Edition
 *
 * 45 seconds @ 30fps = 1350 frames
 *
 * Philosophy: Show Toy + Terminal SIDE BY SIDE simultaneously
 * Left: Abstract toy visualization (40%)
 * Right: Concrete terminal output (60%)
 *
 * Timeline (45s):
 * - 0:00-0:04  Intro: Kinetic "STOP GUESSING" (4s)
 * - 0:04-0:08  CONTEXT: ToyToggle | TerminalContext (4s)
 * - 0:08-0:12  PLAN: ToyMindMap | TerminalPlan (4s)
 * - 0:12-0:16  BUILD: ToyAgentFan | TerminalBuild (4s)
 * - 0:16-0:20  CODE: ToyCodeStream | TerminalCode (4s)
 * - 0:20-0:24  SECURITY: ToyShield | TerminalSecurity (4s)
 * - 0:24-0:28  QUALITY: ToyTrophy | TerminalQuality (4s)
 * - 0:28-0:32  REVIEW: ToyChecklist | TerminalReview (4s)
 * - 0:32-0:36  LEARN: ToyNetwork | TerminalLearn (4s)
 * - 0:36-0:41  Marketplace: InfiniteMarquee (5s)
 * - 0:41-0:45  Outro: Logo + Install (4s)
 */

export const marketplaceDemoSchema = z.object({
  primaryColor: z.string().default(COLORS.primary),
});

type MarketplaceDemoProps = z.infer<typeof marketplaceDemoSchema>;

// Colors
const WHITE = "#FFFFFF";
const BLACK = "#050505";
const PURPLE = "#a855f7";
const PINK = "#ec4899";
const YELLOW = "#f59e0b";
const GREEN = "#22c55e";

// Step definitions for MontageLabel
const STEPS = [
  { name: "CONTEXT", start: 4 },
  { name: "PLAN", start: 8 },
  { name: "BUILD", start: 12 },
  { name: "CODE", start: 16 },
  { name: "SECURITY", start: 20 },
  { name: "QUALITY", start: 24 },
  { name: "REVIEW", start: 28 },
  { name: "LEARN", start: 32 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// INTRO & OUTRO SCENES
// ═══════════════════════════════════════════════════════════════════════════════

// Kinetic Text with HEAVY SLAM physics
// White on black, scale 5→1, letter-spacing 50→0, mass:3 for heavy impact
const KineticSlam: React.FC<{
  words: string[];
  frame: number;
  fps: number;
  fontSize?: number;
}> = ({ words, frame, fps, fontSize = 140 }) => {
  const HEAVY_SLAM = { mass: 3, stiffness: 200, damping: 20 };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BLACK,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
      }}
    >
      {words.map((word, idx) => {
        const wordDelay = idx * fps * 0.2;
        const wordFrame = Math.max(0, frame - wordDelay);

        const slamProgress = spring({ frame: wordFrame, fps, config: HEAVY_SLAM });
        // Scale from 5 → overshoot 0.9 → settle 1
        const wordScale = interpolate(slamProgress, [0, 0.6, 0.85, 1], [5, 0.85, 1.08, 1]);
        // Letter spacing from 50 → 0
        const letterSpacing = interpolate(slamProgress, [0, 1], [50, 0]);

        return (
          <div
            key={idx}
            style={{
              fontSize,
              fontWeight: 900,
              color: WHITE,
              letterSpacing,
              lineHeight: 1,
              transform: `scale(${wordScale})`,
              fontFamily: "Inter, SF Pro Display, -apple-system, sans-serif",
              opacity: slamProgress,
            }}
          >
            {word}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Gradient text component
const GradientText: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <span
    style={{
      background: `linear-gradient(135deg, ${PURPLE}, ${PINK}, ${YELLOW})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      ...style,
    }}
  >
    {children}
  </span>
);

// Outro scene with logo and install command
const OutroScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const logoScale = spring({ frame, fps, config: { stiffness: 150, damping: 15, mass: 1.2 } });
  const showInstall = frame >= fps * 0.6;
  const installFrame = Math.max(0, frame - fps * 0.6);

  const installCmd = "$ /plugin install ork";
  const typedChars = Math.min(installCmd.length, Math.floor((installFrame / fps) * 25));
  const typedCmd = installCmd.slice(0, typedChars);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: WHITE,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
      }}
    >
      {/* Logo */}
      <div style={{ transform: `scale(${logoScale})`, textAlign: "center" }}>
        <GradientText style={{ fontSize: 85, fontWeight: 900, display: "block" }}>
          ORCHESTKIT
        </GradientText>
        <div style={{ color: "#8b949e", fontSize: 22, marginTop: 12 }}>
          Your AI-Powered Development Toolkit
        </div>
      </div>

      {/* Install command */}
      {showInstall && (
        <div
          style={{
            backgroundColor: BLACK,
            borderRadius: 14,
            padding: "18px 36px",
            transform: `scale(${spring({ frame: installFrame, fps, config: { stiffness: 200, damping: 12 } })})`,
          }}
        >
          <span
            style={{
              fontFamily: "SF Mono, Monaco, monospace",
              fontSize: 26,
              color: GREEN,
              fontWeight: 600,
            }}
          >
            {typedCmd}
            {typedChars < installCmd.length && <span style={{ opacity: 0.7 }}>█</span>}
          </span>
        </div>
      )}

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: 50,
          opacity: interpolate(frame, [fps * 1.5, fps * 2], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {[
          { value: ORCHESTKIT_STATS.skills, label: "Skills", icon: "⚡" },
          { value: ORCHESTKIT_STATS.agents, label: "Agents", icon: "🤖" },
          { value: ORCHESTKIT_STATS.hooks, label: "Hooks", icon: "🔗" },
        ].map((stat, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{stat.icon}</span>
            <span style={{ color: BLACK, fontSize: 22, fontWeight: 700 }}>{stat.value}</span>
            <span style={{ color: "#8b949e", fontSize: 16 }}>{stat.label}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const MarketplaceDemo: React.FC<MarketplaceDemoProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate current step for MontageLabel
  const currentStepIndex = STEPS.findIndex((step, idx) => {
    const nextStep = STEPS[idx + 1];
    const currentTime = frame / fps;
    return currentTime >= step.start && (!nextStep || currentTime < nextStep.start);
  });
  const currentStep = currentStepIndex >= 0 ? currentStepIndex + 1 : 0;
  const stepName = currentStep > 0 ? STEPS[currentStep - 1].name : "";

  // Timeline boundaries (45s total = 1350 frames @ 30fps)
  // Each skill: 4s = 120 frames (Toy | Terminal side by side)
  const INTRO_START = 0;
  const INTRO_END = fps * 4; // 0-4s

  const SKILL_DURATION = fps * 4; // 4s per skill

  const SKILL1_START = fps * 4;   // CONTEXT
  const SKILL2_START = fps * 8;   // PLAN
  const SKILL3_START = fps * 12;  // BUILD
  const SKILL4_START = fps * 16;  // CODE
  const SKILL5_START = fps * 20;  // SECURITY
  const SKILL6_START = fps * 24;  // QUALITY
  const SKILL7_START = fps * 28;  // REVIEW
  const SKILL8_START = fps * 32;  // LEARN

  const MARKETPLACE_START = fps * 36;
  const MARKETPLACE_DURATION = fps * 5;
  const OUTRO_START = fps * 41;
  const OUTRO_DURATION = fps * 4;

  return (
    <AbsoluteFill style={{ backgroundColor: BLACK }}>
      <Camera frame={frame} fps={fps} beatInterval={fps * 4}>
        {/* INTRO: Kinetic "STOP GUESSING" (0-4s) */}
        <Sequence from={INTRO_START} durationInFrames={INTRO_END - INTRO_START}>
          <KineticSlam words={["STOP", "GUESSING.", "START", "BUILDING."]} frame={frame} fps={fps} />
        </Sequence>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SKILL 1: CONTEXT - Side by Side (4-8s) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Sequence from={SKILL1_START} durationInFrames={SKILL_DURATION}>
          <SplitScene
            frame={frame - SKILL1_START}
            fps={fps}
            toyComponent={<ToyToggle frame={frame - SKILL1_START} fps={fps} />}
            terminalComponent={
              <CompactTerminal
                frame={frame - SKILL1_START}
                fps={fps}
                config={TERMINAL_CONFIGS.context}
              />
            }
          />
        </Sequence>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SKILL 2: PLAN - Side by Side (8-12s) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Sequence from={SKILL2_START} durationInFrames={SKILL_DURATION}>
          <SplitScene
            frame={frame - SKILL2_START}
            fps={fps}
            toyComponent={<ToyMindMap frame={frame - SKILL2_START} fps={fps} />}
            terminalComponent={
              <CompactTerminal
                frame={frame - SKILL2_START}
                fps={fps}
                config={TERMINAL_CONFIGS.plan}
              />
            }
          />
        </Sequence>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SKILL 3: BUILD - Side by Side (12-16s) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Sequence from={SKILL3_START} durationInFrames={SKILL_DURATION}>
          <SplitScene
            frame={frame - SKILL3_START}
            fps={fps}
            toyComponent={<ToyAgentFan frame={frame - SKILL3_START} fps={fps} />}
            terminalComponent={
              <CompactTerminal
                frame={frame - SKILL3_START}
                fps={fps}
                config={TERMINAL_CONFIGS.build}
              />
            }
          />
        </Sequence>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SKILL 4: CODE - Side by Side (16-20s) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Sequence from={SKILL4_START} durationInFrames={SKILL_DURATION}>
          <SplitScene
            frame={frame - SKILL4_START}
            fps={fps}
            toyComponent={<ToyCodeStream frame={frame - SKILL4_START} fps={fps} />}
            terminalComponent={
              <CompactTerminal
                frame={frame - SKILL4_START}
                fps={fps}
                config={TERMINAL_CONFIGS.code}
              />
            }
          />
        </Sequence>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SKILL 5: SECURITY - Side by Side (20-24s) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Sequence from={SKILL5_START} durationInFrames={SKILL_DURATION}>
          <SplitScene
            frame={frame - SKILL5_START}
            fps={fps}
            toyComponent={<ToyShield frame={frame - SKILL5_START} fps={fps} />}
            terminalComponent={
              <CompactTerminal
                frame={frame - SKILL5_START}
                fps={fps}
                config={TERMINAL_CONFIGS.security}
              />
            }
          />
        </Sequence>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SKILL 6: QUALITY - Side by Side (24-28s) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Sequence from={SKILL6_START} durationInFrames={SKILL_DURATION}>
          <SplitScene
            frame={frame - SKILL6_START}
            fps={fps}
            toyComponent={<ToyTrophy frame={frame - SKILL6_START} fps={fps} />}
            terminalComponent={
              <CompactTerminal
                frame={frame - SKILL6_START}
                fps={fps}
                config={TERMINAL_CONFIGS.quality}
              />
            }
          />
        </Sequence>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SKILL 7: REVIEW - Side by Side (28-32s) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Sequence from={SKILL7_START} durationInFrames={SKILL_DURATION}>
          <SplitScene
            frame={frame - SKILL7_START}
            fps={fps}
            toyComponent={<ToyChecklist frame={frame - SKILL7_START} fps={fps} />}
            terminalComponent={
              <CompactTerminal
                frame={frame - SKILL7_START}
                fps={fps}
                config={TERMINAL_CONFIGS.review}
              />
            }
          />
        </Sequence>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SKILL 8: LEARN - Side by Side (32-36s) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Sequence from={SKILL8_START} durationInFrames={SKILL_DURATION}>
          <SplitScene
            frame={frame - SKILL8_START}
            fps={fps}
            toyComponent={<ToyNetwork frame={frame - SKILL8_START} fps={fps} />}
            terminalComponent={
              <CompactTerminal
                frame={frame - SKILL8_START}
                fps={fps}
                config={TERMINAL_CONFIGS.learn}
              />
            }
          />
        </Sequence>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MARKETPLACE + OUTRO */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Sequence from={MARKETPLACE_START} durationInFrames={MARKETPLACE_DURATION}>
          <InfiniteMarquee frame={frame - MARKETPLACE_START} fps={fps} />
        </Sequence>

        <Sequence from={OUTRO_START} durationInFrames={OUTRO_DURATION}>
          <OutroScene frame={frame - OUTRO_START} fps={fps} />
        </Sequence>
      </Camera>

      {/* Montage Label overlay (visible during skills 1-8) */}
      {currentStep > 0 && frame < MARKETPLACE_START && (
        <MontageLabel
          frame={frame}
          fps={fps}
          currentStep={currentStep}
          stepName={stepName}
          totalSteps={8}
        />
      )}

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundColor: "rgba(255,255,255,0.1)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${interpolate(frame, [0, fps * 45], [0, 100], { extrapolateRight: "clamp" })}%`,
            background: `linear-gradient(90deg, ${PURPLE}, ${PINK}, ${YELLOW})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
