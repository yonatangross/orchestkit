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
            { value: "168", label: "skills", color: "#8b5cf6" },
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
