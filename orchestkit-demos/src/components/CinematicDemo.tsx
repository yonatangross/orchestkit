import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
} from "remotion";
import { z } from "zod";
import { HookScene } from "./scenes/HookScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { ManimScene, ManimPlaceholder } from "./scenes/ManimScene";
import { TerminalScene } from "./scenes/TerminalScene";
import { ResultsScene } from "./scenes/ResultsScene";
import { CTAScene } from "./scenes/CTAScene";
import { SceneTransition } from "./shared/TransitionWipe";

export const cinematicDemoSchema = z.object({
  skillName: z.string(),
  hook: z.string(),
  problemPoints: z.array(z.string()).default([
    "Manual processes slow you down",
    "Context switching kills productivity",
    "No unified workflow",
  ]),
  terminalVideo: z.string(),
  manimVideo: z.string().optional(),
  manimType: z.enum(["agent-spawning", "task-dependency", "workflow"]).optional(),
  results: z.object({
    before: z.string(),
    after: z.string(),
    stats: z.array(
      z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        suffix: z.string().optional(),
      })
    ).default([]),
  }),
  primaryColor: z.string().default("#8b5cf6"),
  ccVersion: z.string().default("CC 2.1.16"),
  // Scene durations in frames
  hookDuration: z.number().default(60),
  problemDuration: z.number().default(90),
  manimDuration: z.number().default(120),
  terminalDuration: z.number().default(300),
  resultsDuration: z.number().default(90),
  ctaDuration: z.number().default(60),
  // Audio options
  backgroundMusic: z.string().optional(),
  musicVolume: z.number().default(0.12),
  enableSoundEffects: z.boolean().default(true),
});

type CinematicDemoProps = z.infer<typeof cinematicDemoSchema>;

export const CinematicDemo: React.FC<CinematicDemoProps> = ({
  skillName,
  hook,
  problemPoints,
  terminalVideo,
  manimVideo,
  manimType = "agent-spawning",
  results,
  primaryColor,
  ccVersion,
  hookDuration,
  problemDuration,
  manimDuration,
  terminalDuration,
  resultsDuration,
  ctaDuration,
  backgroundMusic,
  musicVolume,
  enableSoundEffects,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Calculate scene start frames
  const hookStart = 0;
  const problemStart = hookDuration;
  const manimStart = problemStart + problemDuration;
  const terminalStart = manimStart + manimDuration;
  const resultsStart = terminalStart + terminalDuration;
  const ctaStart = resultsStart + resultsDuration;

  // Transition frames (8 frames each)
  const transitionDuration = 8;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Background Music */}
      {backgroundMusic && (
        <Audio
          src={staticFile(backgroundMusic)}
          volume={(f) => {
            // Fade in at start, fade out at end
            const fadeIn = Math.min(1, f / (fps * 0.5));
            const fadeOut = Math.min(1, (durationInFrames - f) / (fps * 1));
            return fadeIn * fadeOut * musicVolume;
          }}
        />
      )}

      {/* Scene 1: Hook */}
      <Sequence from={hookStart} durationInFrames={hookDuration}>
        <HookScene
          skillName={skillName}
          hook={hook}
          ccVersion={ccVersion}
          primaryColor={primaryColor}
        />
      </Sequence>

      {/* Transition 1 */}
      <SceneTransition
        type="fade"
        startFrame={hookStart + hookDuration - transitionDuration}
        durationFrames={transitionDuration}
      />

      {/* Scene 2: Problem */}
      <Sequence from={problemStart} durationInFrames={problemDuration}>
        <ProblemScene
          problems={problemPoints}
          primaryColor="#ef4444"
          title="Before OrchestKit"
        />
      </Sequence>

      {/* Transition 2 */}
      <SceneTransition
        type="fade"
        startFrame={problemStart + problemDuration - transitionDuration}
        durationFrames={transitionDuration}
      />

      {/* Scene 3: Manim Animation */}
      <Sequence from={manimStart} durationInFrames={manimDuration}>
        {manimVideo ? (
          <ManimScene
            videoPath={manimVideo}
            title="Agent Orchestration"
            subtitle="CC 2.1.16 Task Management"
          />
        ) : (
          <ManimPlaceholder
            type={manimType}
            primaryColor={primaryColor}
            agentCount={6}
          />
        )}
      </Sequence>

      {/* Transition 3 */}
      <SceneTransition
        type="fade"
        startFrame={manimStart + manimDuration - transitionDuration}
        durationFrames={transitionDuration}
      />

      {/* Scene 4: Terminal Demo */}
      <Sequence from={terminalStart} durationInFrames={terminalDuration}>
        <TerminalScene
          videoPath={terminalVideo}
          showHeader={true}
          headerText={`/${skillName} in action`}
          primaryColor={primaryColor}
        />
      </Sequence>

      {/* Transition 4 */}
      <SceneTransition
        type="fade"
        startFrame={terminalStart + terminalDuration - transitionDuration}
        durationFrames={transitionDuration}
      />

      {/* Scene 5: Results */}
      <Sequence from={resultsStart} durationInFrames={resultsDuration}>
        <ResultsScene
          before={results.before}
          after={results.after}
          stats={results.stats}
          primaryColor="#22c55e"
        />
      </Sequence>

      {/* Transition 5 */}
      <SceneTransition
        type="fade"
        startFrame={resultsStart + resultsDuration - transitionDuration}
        durationFrames={transitionDuration}
      />

      {/* Scene 6: CTA */}
      <Sequence from={ctaStart} durationInFrames={ctaDuration}>
        <CTAScene
          installCommand="/plugin install ork"
          primaryColor={primaryColor}
          stats={{ skills: 169, agents: 35 }}
          ccVersion={ccVersion}
        />
      </Sequence>

      {/* Success sound effect on CTA */}
      {enableSoundEffects && frame >= ctaStart && frame < ctaStart + 2 && (
        <Audio src={staticFile("audio/success.mp3")} volume={0.3} />
      )}

      {/* Watermark */}
      <Watermark />

      {/* Progress bar */}
      <ProgressBar
        progress={frame / durationInFrames}
        primaryColor={primaryColor}
      />
    </AbsoluteFill>
  );
};

const Watermark: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 24,
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: 0.6,
      }}
    >
      <span
        style={{
          fontSize: 14,
          color: "#6b7280",
          fontFamily: "Menlo, monospace",
          fontWeight: 500,
        }}
      >
        OrchestKit
      </span>
    </div>
  );
};

const ProgressBar: React.FC<{ progress: number; primaryColor: string }> = ({
  progress,
  primaryColor,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: "rgba(255,255,255,0.1)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${primaryColor}, #6366f1)`,
        }}
      />
    </div>
  );
};
