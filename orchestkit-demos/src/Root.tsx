import React from "react";
import { Composition, Folder } from "remotion";
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
      {/* ╔══════════════════════════════════════════════════════════════════════════════╗
          ║                              🎬 PRODUCTION                                    ║
          ║         Ready-to-render videos organized by aspect ratio & skill              ║
          ╚══════════════════════════════════════════════════════════════════════════════╝ */}
      <Folder name="Production">

        {/* ==================== 📺 LANDSCAPE 16:9 (YouTube, Website) ==================== */}
        <Folder name="Landscape-16x9">

          {/* ─────────── Core Skills: implement, verify, commit, explore ─────────── */}
          <Folder name="Core-Skills">
            <Composition id="Implement" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={implementDemoConfig} />
            <Composition id="Verify" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={verifyDemoConfig} />
            <Composition id="Commit" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={commitDemoConfig} />
            <Composition id="Explore" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={exploreDemoConfig} />
          </Folder>

          {/* ─────────── Memory Skills: remember, recall, load-context, mem0-sync ─────────── */}
          <Folder name="Memory-Skills">
            <Composition id="Remember" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={rememberDemoConfig} />
            <Composition id="Recall" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={recallDemoConfig} />
            <Composition id="LoadContext" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={loadContextDemoConfig} />
            <Composition id="Mem0Sync" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={mem0SyncDemoConfig} />
          </Folder>

          {/* ─────────── Review Skills: review-pr, create-pr, fix-issue ─────────── */}
          <Folder name="Review-Skills">
            <Composition id="ReviewPR" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={reviewPRDemoConfig} />
            <Composition id="CreatePR" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={createPRDemoConfig} />
            <Composition id="FixIssue" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={fixIssueDemoConfig} />
          </Folder>

          {/* ─────────── DevOps Skills: doctor, configure, run-tests, feedback ─────────── */}
          <Folder name="DevOps-Skills">
            <Composition id="Doctor" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={doctorDemoConfig} />
            <Composition id="Configure" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={configureDemoConfig} />
            <Composition id="RunTests" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={runTestsDemoConfig} />
            <Composition id="Feedback" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={feedbackDemoConfig} />
          </Folder>

          {/* ─────────── AI Skills: brainstorming, assess, assess-complexity, decision-history ─────────── */}
          <Folder name="AI-Skills">
            <Composition id="Brainstorming" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={brainstormDemoConfig} />
            <Composition id="Assess" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={assessDemoConfig} />
            <Composition id="AssessComplexity" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={assessComplexityDemoConfig} />
            <Composition id="DecisionHistory" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={decisionHistoryDemoConfig} />
          </Folder>

          {/* ─────────── Advanced Skills: worktree, skill-evolution, demo-producer, add-golden ─────────── */}
          <Folder name="Advanced-Skills">
            <Composition id="WorktreeCoordination" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={worktreeCoordinationDemoConfig} />
            <Composition id="SkillEvolution" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={skillEvolutionDemoConfig} />
            <Composition id="DemoProducer" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={demoProducerDemoConfig} />
            <Composition id="AddGolden" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={addGoldenDemoConfig} />
          </Folder>

          {/* ─────────── Alternative Styles (Same skills, different presentation) ─────────── */}
          <Folder name="Styles">
            <Folder name="ProgressiveZoom">
              <Composition id="PZ-Implement" component={ProgressiveZoom} durationInFrames={FPS * 25} fps={FPS} width={WIDTH} height={HEIGHT} schema={progressiveZoomSchema} defaultProps={{ ...implementDemoConfig, summaryTagline: "Same skill. Any complexity. Production ready." }} />
              <Composition id="PZ-Verify" component={ProgressiveZoom} durationInFrames={FPS * 25} fps={FPS} width={WIDTH} height={HEIGHT} schema={progressiveZoomSchema} defaultProps={{ ...verifyDemoConfig, summaryTagline: "6 agents. Parallel validation. Production confidence." }} />
            </Folder>
            <Folder name="SplitMerge">
              <Composition id="SM-Implement" component={SplitThenMerge} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={splitThenMergeSchema} defaultProps={{ ...implementDemoConfig, splitMessage: "Spawning 3 parallel implementation scenarios...", summaryTagline: "One command. Three complexities. All production-ready." }} />
              <Composition id="SM-ReviewPR" component={SplitThenMerge} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={splitThenMergeSchema} defaultProps={{ ...reviewPRDemoConfig, splitMessage: "Spawning 6 review agents across 3 scenarios...", summaryTagline: "Expert review. Any PR size. Zero blind spots." }} />
            </Folder>
            <Folder name="Cinematic">
              <Composition id="CIN-Verify" component={CinematicDemo} durationInFrames={750} fps={FPS} width={WIDTH} height={HEIGHT} schema={cinematicDemoSchema} defaultProps={{ skillName: "verify", hook: "6 parallel agents validate your feature", problemPoints: ["Manual testing misses edge cases", "Sequential reviews waste hours", "No unified verification report"], terminalVideo: "verify-demo.mp4", manimType: "agent-spawning", results: { before: "3 hours manual review", after: "2 minutes with OrchestKit", stats: [{ label: "Agents", value: 6 }, { label: "Coverage", value: "94", suffix: "%" }, { label: "Time", value: "2", suffix: "min" }] }, primaryColor: "#22c55e", ccVersion: "CC 2.1.16", hookDuration: 60, problemDuration: 90, manimDuration: 120, terminalDuration: 300, resultsDuration: 90, ctaDuration: 90, ...AUDIO_DEFAULTS }} />
              <Composition id="CIN-Explore" component={CinematicDemo} durationInFrames={750} fps={FPS} width={WIDTH} height={HEIGHT} schema={cinematicDemoSchema} defaultProps={{ skillName: "explore", hook: "Understand any codebase instantly", problemPoints: ["Unfamiliar codebases slow you down", "Grep and find miss context", "Documentation is always outdated"], terminalVideo: "explore-demo.mp4", manimType: "agent-spawning", results: { before: "Hours reading code", after: "Minutes with Explore agent", stats: [{ label: "Files", value: 150, suffix: "+" }, { label: "Patterns", value: 12 }, { label: "Depth", value: "thorough" }] }, primaryColor: "#8b5cf6", ccVersion: "CC 2.1.16", hookDuration: 60, problemDuration: 90, manimDuration: 120, terminalDuration: 300, resultsDuration: 90, ctaDuration: 90, ...AUDIO_DEFAULTS }} />
              <Composition id="CIN-ReviewPR" component={CinematicDemo} durationInFrames={750} fps={FPS} width={WIDTH} height={HEIGHT} schema={cinematicDemoSchema} defaultProps={{ skillName: "review-pr", hook: "6 specialized agents review your PR", problemPoints: ["Manual reviews miss security issues", "No consistent review checklist", "Feedback takes days, not minutes"], terminalVideo: "review-pr-demo.mp4", manimType: "agent-spawning", results: { before: "Days waiting for feedback", after: "Instant expert review", stats: [{ label: "Agents", value: 6 }, { label: "Issues", value: 12 }, { label: "Severity", value: "P1-P3" }] }, primaryColor: "#f97316", ccVersion: "CC 2.1.16", hookDuration: 60, problemDuration: 90, manimDuration: 120, terminalDuration: 300, resultsDuration: 90, ctaDuration: 90, ...AUDIO_DEFAULTS }} />
              <Composition id="CIN-Commit" component={CinematicDemo} durationInFrames={600} fps={FPS} width={WIDTH} height={HEIGHT} schema={cinematicDemoSchema} defaultProps={{ skillName: "commit", hook: "AI-generated conventional commits", problemPoints: ["Inconsistent commit messages", "No semantic versioning support", "Manual message writing is tedious"], terminalVideo: "commit-demo.mp4", manimType: "workflow", results: { before: "Inconsistent git history", after: "Clean conventional commits", stats: [{ label: "Format", value: "Conventional" }, { label: "Quality", value: "100", suffix: "%" }] }, primaryColor: "#06b6d4", ccVersion: "CC 2.1.16", hookDuration: 50, problemDuration: 70, manimDuration: 90, terminalDuration: 240, resultsDuration: 70, ctaDuration: 80, ...AUDIO_DEFAULTS }} />
              <Composition id="CIN-Implement" component={CinematicDemo} durationInFrames={900} fps={FPS} width={WIDTH} height={HEIGHT} schema={cinematicDemoSchema} defaultProps={{ skillName: "implement", hook: "Full-power feature implementation", problemPoints: ["Complex features require multiple passes", "No skill injection for context", "Manual coordination between tools"], terminalVideo: "implement-demo.mp4", manimType: "task-dependency", results: { before: "Hours of manual coding", after: "Parallel subagent implementation", stats: [{ label: "Tasks", value: 8 }, { label: "Parallel", value: "Yes" }, { label: "Coverage", value: "85", suffix: "%" }] }, primaryColor: "#8b5cf6", ccVersion: "CC 2.1.16", hookDuration: 60, problemDuration: 90, manimDuration: 150, terminalDuration: 390, resultsDuration: 100, ctaDuration: 110, ...AUDIO_DEFAULTS }} />
            </Folder>
            <Folder name="Hybrid-VHS">
              <Composition id="HYB-InstallDemo" component={VideoDemo} durationInFrames={300} fps={FPS} width={WIDTH} height={HEIGHT} schema={videoDemoSchema} calculateMetadata={calculateVideoDemoMetadata} defaultProps={{ skillName: "plugin install ork", hook: "One command. Full-stack AI toolkit.", terminalVideo: "install-demo.mp4", primaryColor: "#8b5cf6", cta: "/plugin install ork", problemPoints: ["Manual setup takes forever", "No standardized workflows", "Missing best practices"], stats: [{ value: "169", label: "skills", color: "#8b5cf6" }, { value: "35", label: "agents", color: "#22c55e" }, { value: "148", label: "hooks", color: "#f59e0b" }], results: { before: "Hours configuring", after: "Instant productivity" }, ccVersion: "CC 2.1.16" }} />
              <Composition id="HYB-ShowcaseDemo" component={ShowcaseDemo} durationInFrames={900} fps={FPS} width={WIDTH} height={HEIGHT} schema={showcaseDemoSchema} calculateMetadata={calculateShowcaseMetadata} defaultProps={{ terminalVideo: "showcase.mp4", primaryColor: "#8b5cf6" }} />
              <Composition id="HYB-Explore" component={HybridDemo} durationInFrames={FPS * 13} fps={FPS} width={WIDTH} height={HEIGHT} schema={hybridDemoSchema} defaultProps={{ skillName: "explore", hook: "Understand any codebase instantly", terminalVideo: "explore-demo.mp4", ccVersion: "CC 2.1.16", primaryColor: "#8b5cf6", showHook: true, showCTA: true, hookDuration: 45, ctaDuration: 75, ...AUDIO_DEFAULTS }} />
              <Composition id="HYB-Verify" component={HybridDemo} durationInFrames={FPS * 8} fps={FPS} width={WIDTH} height={HEIGHT} schema={hybridDemoSchema} defaultProps={{ skillName: "verify", hook: "6 parallel agents validate your feature", terminalVideo: "verify-demo.mp4", ccVersion: "CC 2.1.16", primaryColor: "#22c55e", showHook: true, showCTA: true, hookDuration: 40, ctaDuration: 60, ...AUDIO_DEFAULTS }} />
              <Composition id="HYB-Commit" component={HybridDemo} durationInFrames={FPS * 8} fps={FPS} width={WIDTH} height={HEIGHT} schema={hybridDemoSchema} defaultProps={{ skillName: "commit", hook: "AI-generated conventional commits", terminalVideo: "commit-demo.mp4", ccVersion: "CC 2.1.16", primaryColor: "#06b6d4", showHook: true, showCTA: true, hookDuration: 40, ctaDuration: 60, ...AUDIO_DEFAULTS }} />
              <Composition id="HYB-Brainstorming" component={HybridDemo} durationInFrames={FPS * 10} fps={FPS} width={WIDTH} height={HEIGHT} schema={hybridDemoSchema} defaultProps={{ skillName: "brainstorming", hook: "Think before you code", terminalVideo: "brainstorming-demo.mp4", ccVersion: "CC 2.1.16", primaryColor: "#f59e0b", showHook: true, showCTA: true, hookDuration: 40, ctaDuration: 70, ...AUDIO_DEFAULTS }} />
              <Composition id="HYB-ReviewPR" component={HybridDemo} durationInFrames={FPS * 13} fps={FPS} width={WIDTH} height={HEIGHT} schema={hybridDemoSchema} defaultProps={{ skillName: "review-pr", hook: "6 specialized agents review your PR", terminalVideo: "review-pr-demo.mp4", ccVersion: "CC 2.1.16", primaryColor: "#f97316", showHook: true, showCTA: true, hookDuration: 45, ctaDuration: 75, ...AUDIO_DEFAULTS }} />
              <Composition id="HYB-Remember" component={HybridDemo} durationInFrames={FPS * 8} fps={FPS} width={WIDTH} height={HEIGHT} schema={hybridDemoSchema} defaultProps={{ skillName: "remember", hook: "Teach Claude your patterns", terminalVideo: "remember-demo.mp4", ccVersion: "CC 2.1.16", primaryColor: "#ec4899", showHook: true, showCTA: true, hookDuration: 40, ctaDuration: 60, ...AUDIO_DEFAULTS }} />
            </Folder>
            <Folder name="SkillPhase">
              <Composition id="ImplementSkillPhaseDemo" component={SkillPhaseDemo} durationInFrames={FPS * 24} fps={FPS} width={WIDTH} height={HEIGHT} schema={skillPhaseDemoSchema} defaultProps={implementSkillPhasesConfig} />
              <Composition id="ImplementPhases" component={PhaseComparison} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={phaseComparisonSchema} defaultProps={implementPhasesConfig} />
            </Folder>
          </Folder>
        </Folder>

        {/* ==================== 📱 VERTICAL 9:16 (TikTok, Reels, Shorts) ==================== */}
        <Folder name="Vertical-9x16">
          <Folder name="TriTerminalRace">
            <Composition id="V-TTR-Implement" component={TriTerminalRaceVertical} durationInFrames={FPS * 18} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={triTerminalRaceVerticalSchema} defaultProps={implementDemoConfig} />
            <Composition id="V-TTR-Verify" component={TriTerminalRaceVertical} durationInFrames={FPS * 18} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={triTerminalRaceVerticalSchema} defaultProps={verifyDemoConfig} />
          </Folder>
          <Folder name="ProgressiveZoom">
            <Composition id="V-PZ-Implement" component={ProgressiveZoomVertical} durationInFrames={FPS * 18} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={progressiveZoomVerticalSchema} defaultProps={{ ...implementDemoConfig, summaryTagline: "Same skill. Any complexity. Production ready." }} />
            <Composition id="V-PZ-Verify" component={ProgressiveZoomVertical} durationInFrames={FPS * 18} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={progressiveZoomVerticalSchema} defaultProps={{ ...verifyDemoConfig, summaryTagline: "6 agents. Parallel validation. Production confidence." }} />
          </Folder>
          <Folder name="SplitMerge">
            <Composition id="V-SM-Implement" component={SplitThenMergeVertical} durationInFrames={FPS * 16} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={splitThenMergeVerticalSchema} defaultProps={{ ...implementDemoConfig, splitMessage: "Spawning 3 parallel implementation scenarios...", summaryTagline: "One command. Three complexities. All production-ready." }} />
            <Composition id="V-SM-ReviewPR" component={SplitThenMergeVertical} durationInFrames={FPS * 16} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={splitThenMergeVerticalSchema} defaultProps={{ ...reviewPRDemoConfig, splitMessage: "Spawning 6 review agents across 3 scenarios...", summaryTagline: "Expert review. Any PR size. Zero blind spots." }} />
          </Folder>
          <Folder name="VHS">
            <Composition id="VVHS-Explore" component={VerticalDemo} durationInFrames={FPS * 15} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={verticalDemoSchema} defaultProps={{ skillName: "explore", hook: "Understand any codebase instantly", terminalVideo: "explore-demo-vertical.mp4", ccVersion: "CC 2.1.16", primaryColor: "#8b5cf6", ...AUDIO_DEFAULTS }} />
            <Composition id="VVHS-Verify" component={VerticalDemo} durationInFrames={FPS * 12} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={verticalDemoSchema} defaultProps={{ skillName: "verify", hook: "6 parallel agents validate your feature", terminalVideo: "verify-demo-vertical.mp4", ccVersion: "CC 2.1.16", primaryColor: "#22c55e", ...AUDIO_DEFAULTS }} />
            <Composition id="VVHS-Commit" component={VerticalDemo} durationInFrames={FPS * 12} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={verticalDemoSchema} defaultProps={{ skillName: "commit", hook: "AI-generated conventional commits", terminalVideo: "commit-demo-vertical.mp4", ccVersion: "CC 2.1.16", primaryColor: "#06b6d4", ...AUDIO_DEFAULTS }} />
            <Composition id="VVHS-Brainstorming" component={VerticalDemo} durationInFrames={FPS * 14} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={verticalDemoSchema} defaultProps={{ skillName: "brainstorming", hook: "Think before you code", terminalVideo: "brainstorming-demo-vertical.mp4", ccVersion: "CC 2.1.16", primaryColor: "#f59e0b", ...AUDIO_DEFAULTS }} />
            <Composition id="VVHS-ReviewPR" component={VerticalDemo} durationInFrames={FPS * 15} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={verticalDemoSchema} defaultProps={{ skillName: "review-pr", hook: "6 specialized agents review your PR", terminalVideo: "review-pr-demo-vertical.mp4", ccVersion: "CC 2.1.16", primaryColor: "#f97316", ...AUDIO_DEFAULTS }} />
            <Composition id="VVHS-Remember" component={VerticalDemo} durationInFrames={FPS * 12} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={verticalDemoSchema} defaultProps={{ skillName: "remember", hook: "Teach Claude your patterns", terminalVideo: "remember-demo-vertical.mp4", ccVersion: "CC 2.1.16", primaryColor: "#ec4899", ...AUDIO_DEFAULTS }} />
          </Folder>
          <Folder name="Cinematic">
            <Composition id="CINV-Verify" component={CinematicVerticalDemo} durationInFrames={540} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={cinematicVerticalDemoSchema} defaultProps={{ skillName: "verify", hook: "6 agents validate your feature", problemPoints: ["Manual testing misses edge cases", "No unified verification report"], terminalVideo: "verify-demo-vertical.mp4", results: { before: "3 hours manual", after: "2 minutes auto" }, primaryColor: "#22c55e", ccVersion: "CC 2.1.16", hookDuration: 45, problemDuration: 60, manimDuration: 90, terminalDuration: 180, resultsDuration: 75, ctaDuration: 90, ...AUDIO_DEFAULTS }} />
            <Composition id="CINV-Explore" component={CinematicVerticalDemo} durationInFrames={540} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={cinematicVerticalDemoSchema} defaultProps={{ skillName: "explore", hook: "Understand any codebase instantly", problemPoints: ["Unfamiliar codebases slow you down", "Documentation is always outdated"], terminalVideo: "explore-demo-vertical.mp4", results: { before: "Hours reading code", after: "Minutes exploring" }, primaryColor: "#8b5cf6", ccVersion: "CC 2.1.16", hookDuration: 45, problemDuration: 60, manimDuration: 90, terminalDuration: 180, resultsDuration: 75, ctaDuration: 90, ...AUDIO_DEFAULTS }} />
            <Composition id="CINV-ReviewPR" component={CinematicVerticalDemo} durationInFrames={540} fps={FPS} width={VERTICAL_WIDTH} height={VERTICAL_HEIGHT} schema={cinematicVerticalDemoSchema} defaultProps={{ skillName: "review-pr", hook: "6 agents review your PR", problemPoints: ["Manual reviews miss issues", "Feedback takes days"], terminalVideo: "review-pr-demo-vertical.mp4", results: { before: "Days waiting", after: "Instant review" }, primaryColor: "#f97316", ccVersion: "CC 2.1.16", hookDuration: 45, problemDuration: 60, manimDuration: 90, terminalDuration: 180, resultsDuration: 75, ctaDuration: 90, ...AUDIO_DEFAULTS }} />
          </Folder>
        </Folder>

        {/* ==================== ⬜ SQUARE 1:1 (LinkedIn, X/Twitter) ==================== */}
        <Folder name="Square-1x1">
          <Folder name="TriTerminalRace">
            <Composition id="SQ-TTR-Implement" component={TriTerminalRaceSquare} durationInFrames={FPS * 20} fps={FPS} width={1080} height={1080} schema={triTerminalRaceSquareSchema} defaultProps={implementDemoConfig} />
            <Composition id="SQ-TTR-Verify" component={TriTerminalRaceSquare} durationInFrames={FPS * 20} fps={FPS} width={1080} height={1080} schema={triTerminalRaceSquareSchema} defaultProps={verifyDemoConfig} />
          </Folder>
          <Folder name="ProgressiveZoom">
            <Composition id="SQ-PZ-Implement" component={ProgressiveZoomSquare} durationInFrames={FPS * 22} fps={FPS} width={1080} height={1080} schema={progressiveZoomSquareSchema} defaultProps={{ ...implementDemoConfig, summaryTagline: "Same skill. Any complexity. Production ready." }} />
            <Composition id="SQ-PZ-Verify" component={ProgressiveZoomSquare} durationInFrames={FPS * 22} fps={FPS} width={1080} height={1080} schema={progressiveZoomSquareSchema} defaultProps={{ ...verifyDemoConfig, summaryTagline: "6 agents. Parallel validation. Production confidence." }} />
          </Folder>
          <Folder name="SplitMerge">
            <Composition id="SQ-SM-Implement" component={SplitThenMergeSquare} durationInFrames={FPS * 20} fps={FPS} width={1080} height={1080} schema={splitThenMergeSquareSchema} defaultProps={{ ...implementDemoConfig, splitMessage: "Spawning 3 parallel implementation scenarios...", summaryTagline: "One command. Three complexities. All production-ready." }} />
            <Composition id="SQ-SM-ReviewPR" component={SplitThenMergeSquare} durationInFrames={FPS * 20} fps={FPS} width={1080} height={1080} schema={splitThenMergeSquareSchema} defaultProps={{ ...reviewPRDemoConfig, splitMessage: "Spawning 6 review agents across 3 scenarios...", summaryTagline: "Expert review. Any PR size. Zero blind spots." }} />
          </Folder>
          <Folder name="Social">
            <Composition id="SpeedrunDemo" component={SpeedrunDemo} durationInFrames={FPS * 15} fps={FPS} width={1080} height={1080} schema={speedrunDemoSchema} defaultProps={{ primaryColor: "#8b5cf6", secondaryColor: "#22c55e", accentColor: "#06b6d4" }} />
            <Composition id="BrainstormingShowcase" component={SkillShowcase} durationInFrames={FPS * 15} fps={FPS} width={1080} height={1080} schema={skillShowcaseSchema} defaultProps={{ configName: "brainstorming", primaryColor: "#f59e0b", secondaryColor: "#8b5cf6", accentColor: "#22c55e" }} />
            <Composition id="HooksAsyncDemo" component={HooksAsyncDemo} durationInFrames={FPS * 15} fps={FPS} width={1080} height={1080} schema={hooksAsyncDemoSchema} defaultProps={{ primaryColor: "#8b5cf6", secondaryColor: "#22c55e", accentColor: "#06b6d4" }} />
          </Folder>
        </Folder>

        {/* ==================== 📦 MARKETING (Brand & Intro) ==================== */}
        <Folder name="Marketing">
          <Composition id="HeroGif" component={HeroGif} durationInFrames={15 * 30} fps={15} width={1200} height={700} schema={heroGifSchema} defaultProps={{ primaryColor: "#8b5cf6", secondaryColor: "#22c55e" }} />
          <Composition id="MarketplaceDemo" component={MarketplaceDemo} durationInFrames={FPS * 45} fps={FPS} width={WIDTH} height={HEIGHT} schema={marketplaceDemoSchema} defaultProps={{ primaryColor: "#a855f7" }} />
          <Composition id="MarketplaceIntro" component={MarketplaceIntro} durationInFrames={FPS * 30} fps={FPS} width={WIDTH} height={HEIGHT} schema={marketplaceIntroSchema} defaultProps={{ primaryColor: "#8b5cf6", secondaryColor: "#22c55e", accentColor: "#06b6d4" }} />
        </Folder>
      </Folder>

      {/* ╔══════════════════════════════════════════════════════════════════════════════╗
          ║                              📐 TEMPLATES                                     ║
          ║       Reference examples of each component style (for learning/copying)       ║
          ╚══════════════════════════════════════════════════════════════════════════════╝ */}
      <Folder name="Templates">
        <Composition id="TPL-TriTerminalRace" component={TriTerminalRace} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={triTerminalRaceSchema} defaultProps={implementDemoConfig} />
        <Composition id="TPL-ProgressiveZoom" component={ProgressiveZoom} durationInFrames={FPS * 25} fps={FPS} width={WIDTH} height={HEIGHT} schema={progressiveZoomSchema} defaultProps={{ ...implementDemoConfig, summaryTagline: "Same skill. Any complexity. Production ready." }} />
        <Composition id="TPL-SplitMerge" component={SplitThenMerge} durationInFrames={FPS * 20} fps={FPS} width={WIDTH} height={HEIGHT} schema={splitThenMergeSchema} defaultProps={{ ...implementDemoConfig, splitMessage: "Spawning 3 parallel implementation scenarios...", summaryTagline: "One command. Three complexities. All production-ready." }} />
        <Composition id="TPL-SkillPhase" component={SkillPhaseDemo} durationInFrames={FPS * 24} fps={FPS} width={WIDTH} height={HEIGHT} schema={skillPhaseDemoSchema} defaultProps={implementSkillPhasesConfig} />
        <Composition id="TPL-Cinematic" component={CinematicDemo} durationInFrames={750} fps={FPS} width={WIDTH} height={HEIGHT} schema={cinematicDemoSchema} defaultProps={{ skillName: "implement", hook: "Full-power feature implementation", problemPoints: ["Complex features require multiple passes", "No skill injection for context", "Manual coordination between tools"], terminalVideo: "implement-demo.mp4", manimType: "task-dependency", results: { before: "Hours of manual coding", after: "Parallel subagent implementation", stats: [{ label: "Tasks", value: 8 }, { label: "Parallel", value: "Yes" }, { label: "Coverage", value: "85", suffix: "%" }] }, primaryColor: "#8b5cf6", ccVersion: "CC 2.1.16", hookDuration: 60, problemDuration: 90, manimDuration: 120, terminalDuration: 300, resultsDuration: 90, ctaDuration: 90, ...AUDIO_DEFAULTS }} />
        <Composition id="TPL-HybridVHS" component={HybridDemo} durationInFrames={FPS * 13} fps={FPS} width={WIDTH} height={HEIGHT} schema={hybridDemoSchema} defaultProps={{ skillName: "explore", hook: "Understand any codebase instantly", terminalVideo: "explore-demo.mp4", ccVersion: "CC 2.1.16", primaryColor: "#8b5cf6", showHook: true, showCTA: true, hookDuration: 45, ctaDuration: 75, ...AUDIO_DEFAULTS }} />
      </Folder>

      {/* ╔══════════════════════════════════════════════════════════════════════════════╗
          ║                              🧪 EXPERIMENTS                                   ║
          ║                   Work in progress, testing new ideas                         ║
          ╚══════════════════════════════════════════════════════════════════════════════╝ */}
      <Folder name="Experiments">
        {/* HeyGen integration - preserved for future use. To re-enable, uncomment imports and compositions */}
        <Composition id="EXP-Placeholder" component={HeroGif} durationInFrames={30} fps={15} width={100} height={100} schema={heroGifSchema} defaultProps={{ primaryColor: "#8b5cf6", secondaryColor: "#22c55e" }} />
      </Folder>
    </>
  );
};
