import React from "react";
import { Composition } from "remotion";
import { HybridDemo, hybridDemoSchema } from "./components/HybridDemo";
import { VerticalDemo, verticalDemoSchema } from "./components/VerticalDemo";
import { CinematicDemo, cinematicDemoSchema } from "./components/CinematicDemo";
import {
  CinematicVerticalDemo,
  cinematicVerticalDemoSchema,
} from "./components/CinematicVerticalDemo";
import {
  VideoDemo,
  videoDemoSchema,
  calculateVideoDemoMetadata,
} from "./components/VideoDemo";
import {
  ShowcaseDemo,
  showcaseDemoSchema,
  calculateShowcaseMetadata,
} from "./components/ShowcaseDemo";
import {
  MarketplaceIntro,
  marketplaceIntroSchema,
} from "./components/MarketplaceIntro";
import {
  SpeedrunDemo,
  speedrunDemoSchema,
} from "./components/SpeedrunDemo";
import {
  SkillShowcase,
  skillShowcaseSchema,
} from "./components/SkillShowcase";
import {
  HooksAsyncDemo,
  hooksAsyncDemoSchema,
} from "./components/HooksAsyncDemo";
import { HeroGif, heroGifSchema } from "./components/HeroGif";
import { MarketplaceDemo, marketplaceDemoSchema } from "./components/MarketplaceDemo";
import {
  TriTerminalRace,
  triTerminalRaceSchema,
} from "./components/TriTerminalRace";
import {
  TriTerminalRaceVertical,
  triTerminalRaceVerticalSchema,
} from "./components/TriTerminalRace-Vertical";
import {
  TriTerminalRaceSquare,
  triTerminalRaceSquareSchema,
} from "./components/TriTerminalRace-Square";
import {
  ProgressiveZoom,
  progressiveZoomSchema,
} from "./components/ProgressiveZoom";
import {
  ProgressiveZoomVertical,
  progressiveZoomVerticalSchema,
} from "./components/ProgressiveZoom-Vertical";
import {
  ProgressiveZoomSquare,
  progressiveZoomSquareSchema,
} from "./components/ProgressiveZoom-Square";
import {
  SplitThenMerge,
  splitThenMergeSchema,
} from "./components/SplitThenMerge";
import {
  SplitThenMergeVertical,
  splitThenMergeVerticalSchema,
} from "./components/SplitThenMerge-Vertical";
import {
  SplitThenMergeSquare,
  splitThenMergeSquareSchema,
} from "./components/SplitThenMerge-Square";
import { implementDemoConfig } from "./components/configs/implement-demo";
import { commitDemoConfig } from "./components/configs/commit-demo";
import { verifyDemoConfig } from "./components/configs/verify-demo";
import { reviewPRDemoConfig } from "./components/configs/review-pr-demo";
import { exploreDemoConfig } from "./components/configs/explore-demo";
import { rememberDemoConfig } from "./components/configs/remember-demo";
import { brainstormDemoConfig } from "./components/configs/brainstorm-demo";
import { assessDemoConfig } from "./components/configs/assess-demo";
import { doctorDemoConfig } from "./components/configs/doctor-demo";
import { createPRDemoConfig } from "./components/configs/create-pr-demo";
import { fixIssueDemoConfig } from "./components/configs/fix-issue-demo";
import { recallDemoConfig } from "./components/configs/recall-demo";
import { loadContextDemoConfig } from "./components/configs/load-context-demo";
import { configureDemoConfig } from "./components/configs/configure-demo";
import { mem0SyncDemoConfig } from "./components/configs/mem0-sync-demo";
import { addGoldenDemoConfig } from "./components/configs/add-golden-demo";
import { demoProducerDemoConfig } from "./components/configs/demo-producer-demo";
import { runTestsDemoConfig } from "./components/configs/run-tests-demo";
import { assessComplexityDemoConfig } from "./components/configs/assess-complexity-demo";
import { skillEvolutionDemoConfig } from "./components/configs/skill-evolution-demo";
import { decisionHistoryDemoConfig } from "./components/configs/decision-history-demo";
import { feedbackDemoConfig } from "./components/configs/feedback-demo";
import { worktreeCoordinationDemoConfig } from "./components/configs/worktree-coordination-demo";
import {
  PhaseComparison,
  phaseComparisonSchema,
} from "./components/PhaseComparison";
import { implementPhasesConfig } from "./components/configs/implement-phases";
import {
  SkillPhaseDemo,
  skillPhaseDemoSchema,
} from "./components/SkillPhaseDemo";
import { implementSkillPhasesConfig } from "./components/configs/implement-skill-phases";
// HeyGen integration (experimental - isolated for future use)
// import { HeyGenDemo } from "./components/HeyGenDemo";
// import { InstallWithAvatarDemo, installWithAvatarDemoSchema } from "./components/InstallWithAvatarDemo";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const VERTICAL_WIDTH = 1080;
const VERTICAL_HEIGHT = 1920;

// Common audio settings
const AUDIO_DEFAULTS = {
  backgroundMusic: "audio/ambient-tech.mp3",
  musicVolume: 0.12,
  enableSoundEffects: true,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ==================== README HERO GIF ==================== */}

      {/* 30-second Hero GIF for README - v4 with larger text and vibrant colors */}
      <Composition
        id="HeroGif"
        component={HeroGif}
        durationInFrames={15 * 30} // 30 seconds @ 15fps
        fps={15}
        width={1200}
        height={700}
        schema={heroGifSchema}
        defaultProps={{
          primaryColor: "#8b5cf6",
          secondaryColor: "#22c55e",
        }}
      />

      {/* ==================== MARKETPLACE DEMO (Option D) ==================== */}

      {/* 45-second v9 "TOY BOX" - 8 SDLC toys, tactile UI, SLAM physics */}
      <Composition
        id="MarketplaceDemo"
        component={MarketplaceDemo}
        durationInFrames={FPS * 45} // 45 seconds @ 30fps (v9 toy box)
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={marketplaceDemoSchema}
        defaultProps={{
          primaryColor: "#a855f7",
        }}
      />

      {/* ==================== MARKETPLACE INTRO ==================== */}

      {/* 30-second Marketplace Intro - Cinematic showcase */}
      <Composition
        id="MarketplaceIntro"
        component={MarketplaceIntro}
        durationInFrames={FPS * 30}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={marketplaceIntroSchema}
        defaultProps={{
          primaryColor: "#8b5cf6",
          secondaryColor: "#22c55e",
          accentColor: "#06b6d4",
        }}
      />

      {/* ==================== X/TWITTER SPEEDRUN (1:1 Square) ==================== */}

      {/* 15-second Speedrun - Timer gimmick, hook in 1 second */}
      <Composition
        id="SpeedrunDemo"
        component={SpeedrunDemo}
        durationInFrames={FPS * 15}
        fps={FPS}
        width={1080}
        height={1080}
        schema={speedrunDemoSchema}
        defaultProps={{
          primaryColor: "#8b5cf6",
          secondaryColor: "#22c55e",
          accentColor: "#06b6d4",
        }}
      />

      {/* 15-second Brainstorming Showcase - Generic factory pattern */}
      <Composition
        id="BrainstormingShowcase"
        component={SkillShowcase}
        durationInFrames={FPS * 15}
        fps={FPS}
        width={1080}
        height={1080}
        schema={skillShowcaseSchema}
        defaultProps={{
          configName: "brainstorming",
          primaryColor: "#f59e0b",
          secondaryColor: "#8b5cf6",
          accentColor: "#22c55e",
        }}
      />

      {/* 15-second Hooks Async Demo - "31 Workers, Zero Wait" */}
      <Composition
        id="HooksAsyncDemo"
        component={HooksAsyncDemo}
        durationInFrames={FPS * 15}
        fps={FPS}
        width={1080}
        height={1080}
        schema={hooksAsyncDemoSchema}
        defaultProps={{
          primaryColor: "#8b5cf6",
          secondaryColor: "#22c55e",
          accentColor: "#06b6d4",
        }}
      />

      {/* ==================== TRI-TERMINAL RACE DEMOS ==================== */}

      {/* 20-second TriTerminalRace - /implement at 3 difficulty levels */}
      <Composition
        id="ImplementTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={implementDemoConfig}
      />

      {/* /commit TriTerminalRace */}
      <Composition
        id="CommitTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={commitDemoConfig}
      />

      {/* /verify TriTerminalRace */}
      <Composition
        id="VerifyTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={verifyDemoConfig}
      />

      {/* /review-pr TriTerminalRace */}
      <Composition
        id="ReviewPRTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={reviewPRDemoConfig}
      />

      {/* /explore TriTerminalRace */}
      <Composition
        id="ExploreTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={exploreDemoConfig}
      />

      {/* /remember TriTerminalRace */}
      <Composition
        id="RememberTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={rememberDemoConfig}
      />

      {/* /brainstorming TriTerminalRace */}
      <Composition
        id="BrainstormingTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={brainstormDemoConfig}
      />

      {/* /assess TriTerminalRace */}
      <Composition
        id="AssessTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={assessDemoConfig}
      />

      {/* /doctor TriTerminalRace */}
      <Composition
        id="DoctorTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={doctorDemoConfig}
      />

      {/* /mem0-sync TriTerminalRace */}
      <Composition
        id="Mem0SyncTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={mem0SyncDemoConfig}
      />

      {/* /add-golden TriTerminalRace */}
      <Composition
        id="AddGoldenTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={addGoldenDemoConfig}
      />

      {/* /demo-producer TriTerminalRace */}
      <Composition
        id="DemoProducerTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={demoProducerDemoConfig}
      />

      {/* /run-tests TriTerminalRace */}
      <Composition
        id="RunTestsTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={runTestsDemoConfig}
      />

      {/* /create-pr TriTerminalRace */}
      <Composition
        id="CreatePRTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={createPRDemoConfig}
      />

      {/* /fix-issue TriTerminalRace */}
      <Composition
        id="FixIssueTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={fixIssueDemoConfig}
      />

      {/* /recall TriTerminalRace */}
      <Composition
        id="RecallTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={recallDemoConfig}
      />

      {/* /load-context TriTerminalRace */}
      <Composition
        id="LoadContextTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={loadContextDemoConfig}
      />

      {/* /configure TriTerminalRace */}
      <Composition
        id="ConfigureTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={configureDemoConfig}
      />

      {/* /assess-complexity TriTerminalRace */}
      <Composition
        id="AssessComplexityTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={assessComplexityDemoConfig}
      />

      {/* /skill-evolution TriTerminalRace */}
      <Composition
        id="SkillEvolutionTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={skillEvolutionDemoConfig}
      />

      {/* /decision-history TriTerminalRace */}
      <Composition
        id="DecisionHistoryTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={decisionHistoryDemoConfig}
      />

      {/* /feedback TriTerminalRace */}
      <Composition
        id="FeedbackTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={feedbackDemoConfig}
      />

      {/* /worktree-coordination TriTerminalRace */}
      <Composition
        id="WorktreeCoordinationTriRace"
        component={TriTerminalRace}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={triTerminalRaceSchema}
        defaultProps={worktreeCoordinationDemoConfig}
      />

      {/* ==================== PHASE COMPARISON DEMOS (NEW) ==================== */}

      {/* /implement PhaseComparison - Phase-centric view, all levels side by side */}
      <Composition
        id="ImplementPhases"
        component={PhaseComparison}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={phaseComparisonSchema}
        defaultProps={implementPhasesConfig}
      />

      {/* ==================== SKILL PHASE DEMO (NEW GENERIC TEMPLATE) ==================== */}

      {/* /implement SkillPhaseDemo - 3 terminals side by side, same phase at same time */}
      <Composition
        id="ImplementSkillPhaseDemo"
        component={SkillPhaseDemo}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={skillPhaseDemoSchema}
        defaultProps={implementSkillPhasesConfig}
      />

      {/* ==================== PROGRESSIVE ZOOM DEMOS ==================== */}

      {/* /implement ProgressiveZoom - Tutorial style */}
      <Composition
        id="ImplementZoom"
        component={ProgressiveZoom}
        durationInFrames={FPS * 25}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={progressiveZoomSchema}
        defaultProps={{
          ...implementDemoConfig,
          summaryTagline: "Same skill. Any complexity. Production ready.",
        }}
      />

      {/* /verify ProgressiveZoom */}
      <Composition
        id="VerifyZoom"
        component={ProgressiveZoom}
        durationInFrames={FPS * 25}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={progressiveZoomSchema}
        defaultProps={{
          ...verifyDemoConfig,
          summaryTagline: "6 agents. Parallel validation. Production confidence.",
        }}
      />

      {/* ==================== SPLIT-THEN-MERGE DEMOS ==================== */}

      {/* /implement SplitThenMerge - Dramatic style */}
      <Composition
        id="ImplementSplitMerge"
        component={SplitThenMerge}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={splitThenMergeSchema}
        defaultProps={{
          ...implementDemoConfig,
          splitMessage: "Spawning 3 parallel implementation scenarios...",
          summaryTagline: "One command. Three complexities. All production-ready.",
        }}
      />

      {/* /review-pr SplitThenMerge */}
      <Composition
        id="ReviewPRSplitMerge"
        component={SplitThenMerge}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={splitThenMergeSchema}
        defaultProps={{
          ...reviewPRDemoConfig,
          splitMessage: "Spawning 6 review agents across 3 scenarios...",
          summaryTagline: "Expert review. Any PR size. Zero blind spots.",
        }}
      />

      {/* ==================== TRI-TERMINAL RACE VARIANTS (VERTICAL 9:16) ==================== */}

      {/* /implement TriTerminalRace - Vertical (TikTok/Reels pace) */}
      <Composition
        id="ImplementTriRace-Vertical"
        component={TriTerminalRaceVertical}
        durationInFrames={FPS * 18}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={triTerminalRaceVerticalSchema}
        defaultProps={implementDemoConfig}
      />

      {/* /verify TriTerminalRace - Vertical */}
      <Composition
        id="VerifyTriRace-Vertical"
        component={TriTerminalRaceVertical}
        durationInFrames={FPS * 18}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={triTerminalRaceVerticalSchema}
        defaultProps={verifyDemoConfig}
      />

      {/* ==================== TRI-TERMINAL RACE VARIANTS (SQUARE 1:1) ==================== */}

      {/* /implement TriTerminalRace - Square (LinkedIn pace) */}
      <Composition
        id="ImplementTriRace-Square"
        component={TriTerminalRaceSquare}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={1080}
        height={1080}
        schema={triTerminalRaceSquareSchema}
        defaultProps={implementDemoConfig}
      />

      {/* /verify TriTerminalRace - Square */}
      <Composition
        id="VerifyTriRace-Square"
        component={TriTerminalRaceSquare}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={1080}
        height={1080}
        schema={triTerminalRaceSquareSchema}
        defaultProps={verifyDemoConfig}
      />

      {/* ==================== PROGRESSIVE ZOOM VARIANTS (VERTICAL 9:16) ==================== */}

      {/* /implement ProgressiveZoom - Vertical (TikTok/Reels pace) */}
      <Composition
        id="ImplementZoom-Vertical"
        component={ProgressiveZoomVertical}
        durationInFrames={FPS * 18}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={progressiveZoomVerticalSchema}
        defaultProps={{
          ...implementDemoConfig,
          summaryTagline: "Same skill. Any complexity. Production ready.",
        }}
      />

      {/* /verify ProgressiveZoom - Vertical */}
      <Composition
        id="VerifyZoom-Vertical"
        component={ProgressiveZoomVertical}
        durationInFrames={FPS * 18}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={progressiveZoomVerticalSchema}
        defaultProps={{
          ...verifyDemoConfig,
          summaryTagline: "6 agents. Parallel validation. Production confidence.",
        }}
      />

      {/* ==================== PROGRESSIVE ZOOM VARIANTS (SQUARE 1:1) ==================== */}

      {/* /implement ProgressiveZoom - Square (LinkedIn pace) */}
      <Composition
        id="ImplementZoom-Square"
        component={ProgressiveZoomSquare}
        durationInFrames={FPS * 22}
        fps={FPS}
        width={1080}
        height={1080}
        schema={progressiveZoomSquareSchema}
        defaultProps={{
          ...implementDemoConfig,
          summaryTagline: "Same skill. Any complexity. Production ready.",
        }}
      />

      {/* /verify ProgressiveZoom - Square */}
      <Composition
        id="VerifyZoom-Square"
        component={ProgressiveZoomSquare}
        durationInFrames={FPS * 22}
        fps={FPS}
        width={1080}
        height={1080}
        schema={progressiveZoomSquareSchema}
        defaultProps={{
          ...verifyDemoConfig,
          summaryTagline: "6 agents. Parallel validation. Production confidence.",
        }}
      />

      {/* ==================== SPLIT-THEN-MERGE VARIANTS (VERTICAL 9:16) ==================== */}

      {/* /implement SplitThenMerge - Vertical (TikTok/Reels pace) */}
      <Composition
        id="ImplementSplitMerge-Vertical"
        component={SplitThenMergeVertical}
        durationInFrames={FPS * 16}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={splitThenMergeVerticalSchema}
        defaultProps={{
          ...implementDemoConfig,
          splitMessage: "Spawning 3 parallel implementation scenarios...",
          summaryTagline: "One command. Three complexities. All production-ready.",
        }}
      />

      {/* /review-pr SplitThenMerge - Vertical */}
      <Composition
        id="ReviewPRSplitMerge-Vertical"
        component={SplitThenMergeVertical}
        durationInFrames={FPS * 16}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={splitThenMergeVerticalSchema}
        defaultProps={{
          ...reviewPRDemoConfig,
          splitMessage: "Spawning 6 review agents across 3 scenarios...",
          summaryTagline: "Expert review. Any PR size. Zero blind spots.",
        }}
      />

      {/* ==================== SPLIT-THEN-MERGE VARIANTS (SQUARE 1:1) ==================== */}

      {/* /implement SplitThenMerge - Square (LinkedIn pace) */}
      <Composition
        id="ImplementSplitMerge-Square"
        component={SplitThenMergeSquare}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={1080}
        height={1080}
        schema={splitThenMergeSquareSchema}
        defaultProps={{
          ...implementDemoConfig,
          splitMessage: "Spawning 3 parallel implementation scenarios...",
          summaryTagline: "One command. Three complexities. All production-ready.",
        }}
      />

      {/* /review-pr SplitThenMerge - Square */}
      <Composition
        id="ReviewPRSplitMerge-Square"
        component={SplitThenMergeSquare}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={1080}
        height={1080}
        schema={splitThenMergeSquareSchema}
        defaultProps={{
          ...reviewPRDemoConfig,
          splitMessage: "Spawning 6 review agents across 3 scenarios...",
          summaryTagline: "Expert review. Any PR size. Zero blind spots.",
        }}
      />

      {/* ==================== HEYGEN DEMOS (Experimental - Disabled) ====================

      HeyGen integration is preserved but isolated for future use.
      To re-enable:
      1. Uncomment imports at top of file
      2. Uncomment compositions below
      3. Run: npm run heygen:test to verify API
      4. Run: npm run heygen:generate:install to create avatar video

      <Composition
        id="HeyGenDemo"
        component={HeyGenDemo}
        durationInFrames={FPS * 60}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ avatarVideoUrl: "", showPlaceholder: true }}
      />

      <Composition
        id="InstallWithAvatarDemo"
        component={InstallWithAvatarDemo}
        durationInFrames={FPS * 30}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={installWithAvatarDemoSchema}
        defaultProps={{
          avatarVideoUrl: "videos/install-avatar.mp4",
          terminalVideoUrl: "install-demo.mp4",
          showPlaceholder: false,
          primaryColor: "#8b5cf6",
        }}
      />

      ==================== END HEYGEN DEMOS ==================== */}

      {/* ==================== HORIZONTAL 16:9 DEMOS ==================== */}

      {/* /plugin install - Video-driven duration (2026 pattern) */}
      <Composition
        id="InstallDemo"
        component={VideoDemo}
        durationInFrames={300} // Overridden by calculateMetadata
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={videoDemoSchema}
        calculateMetadata={calculateVideoDemoMetadata}
        defaultProps={{
          skillName: "plugin install ork",
          hook: "One command. Full-stack AI toolkit.",
          terminalVideo: "install-demo.mp4",
          primaryColor: "#8b5cf6",
          cta: "/plugin install ork",
          problemPoints: [
            "Manual setup takes forever",
            "No standardized workflows",
            "Missing best practices",
          ],
          stats: [
            { value: "169", label: "skills", color: "#8b5cf6" },
            { value: "35", label: "agents", color: "#22c55e" },
            { value: "148", label: "hooks", color: "#f59e0b" },
          ],
          results: {
            before: "Hours configuring",
            after: "Instant productivity",
          },
          ccVersion: "CC 2.1.16",
        }}
      />

      {/* 30-second Plugin Showcase - All commands */}
      <Composition
        id="ShowcaseDemo"
        component={ShowcaseDemo}
        durationInFrames={900} // Overridden by calculateMetadata
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={showcaseDemoSchema}
        calculateMetadata={calculateShowcaseMetadata}
        defaultProps={{
          terminalVideo: "showcase.mp4",
          primaryColor: "#8b5cf6",
        }}
      />

      {/* /explore - 13s VHS video */}
      <Composition
        id="ExploreDemo"
        component={HybridDemo}
        durationInFrames={FPS * 13}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={hybridDemoSchema}
        defaultProps={{
          skillName: "explore",
          hook: "Understand any codebase instantly",
          terminalVideo: "explore-demo.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#8b5cf6",
          showHook: true,
          showCTA: true,
          hookDuration: 45,
          ctaDuration: 75,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /verify - 8s VHS video */}
      <Composition
        id="VerifyDemo"
        component={HybridDemo}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={hybridDemoSchema}
        defaultProps={{
          skillName: "verify",
          hook: "6 parallel agents validate your feature",
          terminalVideo: "verify-demo.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#22c55e",
          showHook: true,
          showCTA: true,
          hookDuration: 40,
          ctaDuration: 60,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /commit - 8s VHS video */}
      <Composition
        id="CommitDemo"
        component={HybridDemo}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={hybridDemoSchema}
        defaultProps={{
          skillName: "commit",
          hook: "AI-generated conventional commits",
          terminalVideo: "commit-demo.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#06b6d4",
          showHook: true,
          showCTA: true,
          hookDuration: 40,
          ctaDuration: 60,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /brainstorming - 10s VHS video */}
      <Composition
        id="BrainstormingDemo"
        component={HybridDemo}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={hybridDemoSchema}
        defaultProps={{
          skillName: "brainstorming",
          hook: "Think before you code",
          terminalVideo: "brainstorming-demo.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#f59e0b",
          showHook: true,
          showCTA: true,
          hookDuration: 40,
          ctaDuration: 70,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /review-pr - 13s VHS video */}
      <Composition
        id="ReviewPRDemo"
        component={HybridDemo}
        durationInFrames={FPS * 13}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={hybridDemoSchema}
        defaultProps={{
          skillName: "review-pr",
          hook: "6 specialized agents review your PR",
          terminalVideo: "review-pr-demo.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#f97316",
          showHook: true,
          showCTA: true,
          hookDuration: 45,
          ctaDuration: 75,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /remember - 8s VHS video */}
      <Composition
        id="RememberDemo"
        component={HybridDemo}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={hybridDemoSchema}
        defaultProps={{
          skillName: "remember",
          hook: "Teach Claude your patterns",
          terminalVideo: "remember-demo.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#ec4899",
          showHook: true,
          showCTA: true,
          hookDuration: 40,
          ctaDuration: 60,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* ==================== VERTICAL 9:16 DEMOS (TikTok/Reels) ==================== */}

      {/* /explore - Vertical */}
      <Composition
        id="ExploreDemo-Vertical"
        component={VerticalDemo}
        durationInFrames={FPS * 15}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={verticalDemoSchema}
        defaultProps={{
          skillName: "explore",
          hook: "Understand any codebase instantly",
          terminalVideo: "explore-demo-vertical.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#8b5cf6",
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /verify - Vertical */}
      <Composition
        id="VerifyDemo-Vertical"
        component={VerticalDemo}
        durationInFrames={FPS * 12}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={verticalDemoSchema}
        defaultProps={{
          skillName: "verify",
          hook: "6 parallel agents validate your feature",
          terminalVideo: "verify-demo-vertical.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#22c55e",
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /commit - Vertical */}
      <Composition
        id="CommitDemo-Vertical"
        component={VerticalDemo}
        durationInFrames={FPS * 12}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={verticalDemoSchema}
        defaultProps={{
          skillName: "commit",
          hook: "AI-generated conventional commits",
          terminalVideo: "commit-demo-vertical.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#06b6d4",
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /brainstorming - Vertical */}
      <Composition
        id="BrainstormingDemo-Vertical"
        component={VerticalDemo}
        durationInFrames={FPS * 14}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={verticalDemoSchema}
        defaultProps={{
          skillName: "brainstorming",
          hook: "Think before you code",
          terminalVideo: "brainstorming-demo-vertical.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#f59e0b",
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /review-pr - Vertical */}
      <Composition
        id="ReviewPRDemo-Vertical"
        component={VerticalDemo}
        durationInFrames={FPS * 15}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={verticalDemoSchema}
        defaultProps={{
          skillName: "review-pr",
          hook: "6 specialized agents review your PR",
          terminalVideo: "review-pr-demo-vertical.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#f97316",
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /remember - Vertical */}
      <Composition
        id="RememberDemo-Vertical"
        component={VerticalDemo}
        durationInFrames={FPS * 12}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={verticalDemoSchema}
        defaultProps={{
          skillName: "remember",
          hook: "Teach Claude your patterns",
          terminalVideo: "remember-demo-vertical.mp4",
          ccVersion: "CC 2.1.16",
          primaryColor: "#ec4899",
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* ==================== CINEMATIC 16:9 DEMOS ==================== */}

      {/* /verify - Cinematic (25 seconds) */}
      <Composition
        id="VerifyCinematicDemo"
        component={CinematicDemo}
        durationInFrames={750} // 25 seconds at 30fps
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={cinematicDemoSchema}
        defaultProps={{
          skillName: "verify",
          hook: "6 parallel agents validate your feature",
          problemPoints: [
            "Manual testing misses edge cases",
            "Sequential reviews waste hours",
            "No unified verification report",
          ],
          terminalVideo: "verify-demo.mp4",
          manimType: "agent-spawning",
          results: {
            before: "3 hours manual review",
            after: "2 minutes with OrchestKit",
            stats: [
              { label: "Agents", value: 6 },
              { label: "Coverage", value: "94", suffix: "%" },
              { label: "Time", value: "2", suffix: "min" },
            ],
          },
          primaryColor: "#22c55e",
          ccVersion: "CC 2.1.16",
          hookDuration: 60,
          problemDuration: 90,
          manimDuration: 120,
          terminalDuration: 300,
          resultsDuration: 90,
          ctaDuration: 90,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /explore - Cinematic (25 seconds) */}
      <Composition
        id="ExploreCinematicDemo"
        component={CinematicDemo}
        durationInFrames={750}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={cinematicDemoSchema}
        defaultProps={{
          skillName: "explore",
          hook: "Understand any codebase instantly",
          problemPoints: [
            "Unfamiliar codebases slow you down",
            "Grep and find miss context",
            "Documentation is always outdated",
          ],
          terminalVideo: "explore-demo.mp4",
          manimType: "agent-spawning",
          results: {
            before: "Hours reading code",
            after: "Minutes with Explore agent",
            stats: [
              { label: "Files", value: 150, suffix: "+" },
              { label: "Patterns", value: 12 },
              { label: "Depth", value: "thorough" },
            ],
          },
          primaryColor: "#8b5cf6",
          ccVersion: "CC 2.1.16",
          hookDuration: 60,
          problemDuration: 90,
          manimDuration: 120,
          terminalDuration: 300,
          resultsDuration: 90,
          ctaDuration: 90,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /review-pr - Cinematic (25 seconds) */}
      <Composition
        id="ReviewPRCinematicDemo"
        component={CinematicDemo}
        durationInFrames={750}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={cinematicDemoSchema}
        defaultProps={{
          skillName: "review-pr",
          hook: "6 specialized agents review your PR",
          problemPoints: [
            "Manual reviews miss security issues",
            "No consistent review checklist",
            "Feedback takes days, not minutes",
          ],
          terminalVideo: "review-pr-demo.mp4",
          manimType: "agent-spawning",
          results: {
            before: "Days waiting for feedback",
            after: "Instant expert review",
            stats: [
              { label: "Agents", value: 6 },
              { label: "Issues", value: 12 },
              { label: "Severity", value: "P1-P3" },
            ],
          },
          primaryColor: "#f97316",
          ccVersion: "CC 2.1.16",
          hookDuration: 60,
          problemDuration: 90,
          manimDuration: 120,
          terminalDuration: 300,
          resultsDuration: 90,
          ctaDuration: 90,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /commit - Cinematic (20 seconds) */}
      <Composition
        id="CommitCinematicDemo"
        component={CinematicDemo}
        durationInFrames={600}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={cinematicDemoSchema}
        defaultProps={{
          skillName: "commit",
          hook: "AI-generated conventional commits",
          problemPoints: [
            "Inconsistent commit messages",
            "No semantic versioning support",
            "Manual message writing is tedious",
          ],
          terminalVideo: "commit-demo.mp4",
          manimType: "workflow",
          results: {
            before: "Inconsistent git history",
            after: "Clean conventional commits",
            stats: [
              { label: "Format", value: "Conventional" },
              { label: "Quality", value: "100", suffix: "%" },
            ],
          },
          primaryColor: "#06b6d4",
          ccVersion: "CC 2.1.16",
          hookDuration: 50,
          problemDuration: 70,
          manimDuration: 90,
          terminalDuration: 240,
          resultsDuration: 70,
          ctaDuration: 80,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /implement - Cinematic (30 seconds) */}
      <Composition
        id="ImplementCinematicDemo"
        component={CinematicDemo}
        durationInFrames={900}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={cinematicDemoSchema}
        defaultProps={{
          skillName: "implement",
          hook: "Full-power feature implementation",
          problemPoints: [
            "Complex features require multiple passes",
            "No skill injection for context",
            "Manual coordination between tools",
          ],
          terminalVideo: "implement-demo.mp4",
          manimType: "task-dependency",
          results: {
            before: "Hours of manual coding",
            after: "Parallel subagent implementation",
            stats: [
              { label: "Tasks", value: 8 },
              { label: "Parallel", value: "Yes" },
              { label: "Coverage", value: "85", suffix: "%" },
            ],
          },
          primaryColor: "#8b5cf6",
          ccVersion: "CC 2.1.16",
          hookDuration: 60,
          problemDuration: 90,
          manimDuration: 150,
          terminalDuration: 390,
          resultsDuration: 100,
          ctaDuration: 110,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* ==================== CINEMATIC VERTICAL 9:16 DEMOS ==================== */}

      {/* /verify - Cinematic Vertical */}
      <Composition
        id="VerifyCinematicDemo-Vertical"
        component={CinematicVerticalDemo}
        durationInFrames={540} // 18 seconds
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={cinematicVerticalDemoSchema}
        defaultProps={{
          skillName: "verify",
          hook: "6 agents validate your feature",
          problemPoints: [
            "Manual testing misses edge cases",
            "No unified verification report",
          ],
          terminalVideo: "verify-demo-vertical.mp4",
          results: {
            before: "3 hours manual",
            after: "2 minutes auto",
          },
          primaryColor: "#22c55e",
          ccVersion: "CC 2.1.16",
          hookDuration: 45,
          problemDuration: 60,
          manimDuration: 90,
          terminalDuration: 180,
          resultsDuration: 75,
          ctaDuration: 90,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /explore - Cinematic Vertical */}
      <Composition
        id="ExploreCinematicDemo-Vertical"
        component={CinematicVerticalDemo}
        durationInFrames={540}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={cinematicVerticalDemoSchema}
        defaultProps={{
          skillName: "explore",
          hook: "Understand any codebase instantly",
          problemPoints: [
            "Unfamiliar codebases slow you down",
            "Documentation is always outdated",
          ],
          terminalVideo: "explore-demo-vertical.mp4",
          results: {
            before: "Hours reading code",
            after: "Minutes exploring",
          },
          primaryColor: "#8b5cf6",
          ccVersion: "CC 2.1.16",
          hookDuration: 45,
          problemDuration: 60,
          manimDuration: 90,
          terminalDuration: 180,
          resultsDuration: 75,
          ctaDuration: 90,
          ...AUDIO_DEFAULTS,
        }}
      />

      {/* /review-pr - Cinematic Vertical */}
      <Composition
        id="ReviewPRCinematicDemo-Vertical"
        component={CinematicVerticalDemo}
        durationInFrames={540}
        fps={FPS}
        width={VERTICAL_WIDTH}
        height={VERTICAL_HEIGHT}
        schema={cinematicVerticalDemoSchema}
        defaultProps={{
          skillName: "review-pr",
          hook: "6 agents review your PR",
          problemPoints: [
            "Manual reviews miss issues",
            "Feedback takes days",
          ],
          terminalVideo: "review-pr-demo-vertical.mp4",
          results: {
            before: "Days waiting",
            after: "Instant review",
          },
          primaryColor: "#f97316",
          ccVersion: "CC 2.1.16",
          hookDuration: 45,
          problemDuration: 60,
          manimDuration: 90,
          terminalDuration: 180,
          resultsDuration: 75,
          ctaDuration: 90,
          ...AUDIO_DEFAULTS,
        }}
      />
    </>
  );
};
