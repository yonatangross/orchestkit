import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  random,
} from "remotion";
import { z } from "zod";
import { ORCHESTKIT_STATS, COLORS } from "../constants";

/**
 * MarketplaceDemo v5 - SDLC-Ordered Skills Redesign
 *
 * 40 seconds @ 30fps = 1200 frames
 * Timeline:
 * - Hook: 0-2s (frames 0-60) - Stats pop + gradient title
 * - /explore: 2-5s (frames 60-150) - UNDERSTAND phase
 * - /brainstorming: 5-8s (frames 150-240) - PLAN phase
 * - /implement: 8-18s (frames 240-540) - BUILD phase (hero, longest)
 * - /verify: 18-25s (frames 540-750) - QUALITY phase
 * - /commit: 25-28s (frames 750-840) - SHIP phase
 * - /review-pr: 28-31s (frames 840-930) - REVIEW phase
 * - /fix-issue: 31-34s (frames 930-1020) - ITERATE phase
 * - /remember: 34-37s (frames 1020-1110) - LEARN phase
 * - CTA: 37-40s (frames 1110-1200) - Install + social proof
 */

export const marketplaceDemoSchema = z.object({
  primaryColor: z.string().default(COLORS.primary),
});

type MarketplaceDemoProps = z.infer<typeof marketplaceDemoSchema>;

// Colors
const WHITE = "#FFFFFF";
const BLACK = "#050505";
const SURFACE = "#0d1117";
const SURFACE_LIGHT = "#161b22";
const BORDER = "#30363d";
const TEXT = "#e6edf3";
const TEXT_DIM = "#8b949e";
const PURPLE = "#a855f7";
const PINK = "#ec4899";
const YELLOW = "#f59e0b";
const GREEN = "#22c55e";
const CYAN = "#06b6d4";
const RED = "#ef4444";
const BLUE = "#3b82f6";
const ORANGE = "#f97316";

// SDLC Phase colors
const PHASE_COLORS = {
  UNDERSTAND: CYAN,
  PLAN: YELLOW,
  BUILD: PURPLE,
  QUALITY: GREEN,
  SHIP: PINK,
  REVIEW: BLUE,
  ITERATE: ORANGE,
  LEARN: PURPLE,
};

// Spring configs - AnimStats style
const SNAPPY = { damping: 12, stiffness: 200 };
const POP = { damping: 10, stiffness: 300, mass: 0.8 };
const OVERSHOOT = { damping: 12, stiffness: 200 }; // For pop overshoot effect

// Gradient text - AnimStats style
const GradientText: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <span style={{
    background: `linear-gradient(90deg, ${PURPLE}, ${PINK}, ${YELLOW})`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    ...style,
  }}>
    {children}
  </span>
);

// Phase Label Badge - shows in top-right corner
const PhaseLabel: React.FC<{ phase: keyof typeof PHASE_COLORS; frame: number; fps: number }> = ({ phase, frame, fps }) => {
  const scale = spring({ frame, fps, config: OVERSHOOT });
  const color = PHASE_COLORS[phase];

  return (
    <div style={{
      position: "absolute",
      top: 24,
      right: 24,
      backgroundColor: `${color}20`,
      border: `2px solid ${color}`,
      borderRadius: 8,
      padding: "8px 16px",
      transform: `scale(${scale})`,
      zIndex: 100,
    }}>
      <span style={{
        color,
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: 2,
        fontFamily: "SF Mono, Monaco, monospace",
      }}>
        {phase}
      </span>
    </div>
  );
};

// Terminal Window Component with phase label
const TerminalWindow: React.FC<{
  children: React.ReactNode;
  title?: string;
  phase?: keyof typeof PHASE_COLORS;
  style?: React.CSSProperties;
  frame?: number;
  fps?: number;
}> = ({ children, title = "Claude Code", phase, style, frame = 0, fps = 30 }) => (
  <div style={{
    backgroundColor: SURFACE,
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
    position: "relative",
    ...style,
  }}>
    {phase && <PhaseLabel phase={phase} frame={frame} fps={fps} />}
    {/* Title bar */}
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "12px 16px",
      backgroundColor: SURFACE_LIGHT,
      borderBottom: `1px solid ${BORDER}`,
      gap: 12,
    }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#ff5f57" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#febc2e" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#28c840" }} />
      </div>
      <span style={{ color: TEXT_DIM, fontSize: 13, fontWeight: 500 }}>{title}</span>
    </div>
    {/* Content */}
    <div style={{ padding: 20, fontFamily: "SF Mono, Monaco, Menlo, monospace" }}>
      {children}
    </div>
  </div>
);

// Task Box Component
const TaskBox: React.FC<{
  id: number;
  title: string;
  status: "running" | "complete";
  frame: number;
}> = ({ id, title, status, frame }) => {
  const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const spinnerIdx = Math.floor(frame / 3) % SPINNER.length;

  return (
    <div style={{
      backgroundColor: SURFACE_LIGHT,
      border: `1px solid ${status === "complete" ? GREEN : PURPLE}`,
      borderRadius: 8,
      padding: "12px 16px",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: status === "complete" ? GREEN : YELLOW, fontSize: 16 }}>
          {status === "complete" ? "✓" : SPINNER[spinnerIdx]}
        </span>
        <span style={{ color: PURPLE, fontWeight: 600 }}>Task #{id}:</span>
        <span style={{ color: TEXT }}>{title}</span>
      </div>
    </div>
  );
};

// Agent Card Component with clamped progress bar (AnimStats fix)
const AgentCard: React.FC<{
  icon: string;
  name: string;
  task: string;
  progress: number;
  color: string;
  frame: number;
}> = ({ icon, name, task, progress, color, frame }) => {
  const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const spinnerIdx = Math.floor(frame / 3) % SPINNER.length;
  const isDone = progress >= 100;

  // CLAMPED progress to prevent flickering (AnimStats fix)
  const clampedProgress = interpolate(progress, [0, 100], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{
      backgroundColor: SURFACE_LIGHT,
      borderRadius: 12,
      border: `2px solid ${isDone ? GREEN : color}`,
      padding: 20,
      minWidth: 200,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 32 }}>{icon}</span>
        <div>
          <div style={{ color, fontWeight: 700, fontSize: 16 }}>{name}</div>
          <div style={{ color: TEXT_DIM, fontSize: 13 }}>{task}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 8, backgroundColor: BORDER, borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${clampedProgress}%`,
            backgroundColor: isDone ? GREEN : color,
            borderRadius: 4,
          }} />
        </div>
        <span style={{ color: isDone ? GREEN : TEXT_DIM, fontSize: 13, minWidth: 50 }}>
          {isDone ? "✓ Done" : `${SPINNER[spinnerIdx]} ${Math.floor(clampedProgress)}%`}
        </span>
      </div>
    </div>
  );
};

// File Tree Component
const FileTree: React.FC<{ files: { path: string; isNew?: boolean }[]; visibleCount: number }> = ({ files, visibleCount }) => (
  <div style={{ backgroundColor: SURFACE_LIGHT, borderRadius: 8, padding: 16 }}>
    <div style={{ color: TEXT_DIM, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>FILES CREATED</div>
    {files.slice(0, visibleCount).map((file, idx) => (
      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ color: GREEN }}>+</span>
        <span style={{ color: TEXT, fontSize: 14 }}>{file.path}</span>
        {file.isNew && <span style={{ color: GREEN, fontSize: 11, backgroundColor: `${GREEN}20`, padding: "2px 6px", borderRadius: 4 }}>NEW</span>}
      </div>
    ))}
  </div>
);

// Code Preview Component
const CodePreview: React.FC<{ filename: string; lines: { code: string; color: string }[]; typedLines: number }> = ({ filename, lines, typedLines }) => (
  <div style={{ backgroundColor: SURFACE_LIGHT, borderRadius: 8, overflow: "hidden" }}>
    <div style={{ padding: "8px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: GREEN, fontSize: 10 }}>●</span>
      <span style={{ color: TEXT_DIM, fontSize: 13 }}>{filename}</span>
    </div>
    <div style={{ padding: 16 }}>
      {lines.slice(0, typedLines).map((line, idx) => (
        <div key={idx} style={{ color: line.color, fontSize: 14, marginBottom: 4, fontFamily: "SF Mono, monospace" }}>
          {line.code}
        </div>
      ))}
    </div>
  </div>
);

// Verification Table Component
const VerificationTable: React.FC<{
  dimensions: { icon: string; name: string; score: number; detail: string; color: string }[];
  visibleRows: number;
  showComposite: boolean;
  compositeScore: number;
}> = ({ dimensions, visibleRows, showComposite, compositeScore }) => (
  <div style={{ backgroundColor: SURFACE_LIGHT, borderRadius: 12, overflow: "hidden" }}>
    {/* Header */}
    <div style={{
      display: "grid",
      gridTemplateColumns: "200px 100px 1fr",
      padding: "12px 20px",
      borderBottom: `1px solid ${BORDER}`,
      backgroundColor: SURFACE,
    }}>
      <span style={{ color: TEXT_DIM, fontSize: 13, fontWeight: 600 }}>DIMENSION</span>
      <span style={{ color: TEXT_DIM, fontSize: 13, fontWeight: 600 }}>SCORE</span>
      <span style={{ color: TEXT_DIM, fontSize: 13, fontWeight: 600 }}>DETAILS</span>
    </div>
    {/* Rows */}
    {dimensions.slice(0, visibleRows).map((dim, idx) => (
      <div key={idx} style={{
        display: "grid",
        gridTemplateColumns: "200px 100px 1fr",
        padding: "14px 20px",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{dim.icon}</span>
          <span style={{ color: TEXT, fontWeight: 500 }}>{dim.name}</span>
        </div>
        <span style={{ color: dim.color, fontWeight: 700, fontSize: 18 }}>{dim.score}/10</span>
        <span style={{ color: TEXT_DIM }}>{dim.detail}</span>
      </div>
    ))}
    {/* Composite */}
    {showComposite && (
      <div style={{
        display: "grid",
        gridTemplateColumns: "200px 100px 1fr",
        padding: "16px 20px",
        backgroundColor: `${GREEN}10`,
      }}>
        <span style={{ color: TEXT, fontWeight: 700, fontSize: 16 }}>COMPOSITE SCORE</span>
        <GradientText style={{ fontWeight: 900, fontSize: 24 }}>{compositeScore}</GradientText>
        <span style={{ color: GREEN, fontWeight: 600 }}>Grade: A - Ready for merge</span>
      </div>
    )}
  </div>
);

// Test Results Component (explicit UNIT/INTEGRATION/E2E separation)
const TestResults: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const tests = [
    { type: "UNIT", count: 6, total: 6, color: CYAN, icon: "🧪" },
    { type: "INTEGRATION", count: 4, total: 4, color: YELLOW, icon: "🔗" },
    { type: "E2E", count: 2, total: 2, color: GREEN, icon: "🎯" },
  ];

  return (
    <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
      {tests.map((test, idx) => {
        const testDelay = idx * fps * 0.3;
        const testFrame = frame - testDelay;
        if (testFrame <= 0) return null;

        const scale = spring({ frame: testFrame, fps, config: OVERSHOOT });
        // Pop from 1.1 to 1.0 (overshoot effect)
        const popScale = interpolate(scale, [0, 1], [0, 1.1], { extrapolateRight: "clamp" });
        const finalScale = popScale > 1 ? interpolate(testFrame, [0, fps * 0.3], [1.1, 1], { extrapolateRight: "clamp" }) : popScale;

        return (
          <div key={idx} style={{
            backgroundColor: SURFACE_LIGHT,
            border: `2px solid ${test.color}`,
            borderRadius: 12,
            padding: "16px 24px",
            textAlign: "center",
            transform: `scale(${finalScale})`,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{test.icon}</div>
            <div style={{ color: test.color, fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{test.type}</div>
            <div style={{ color: TEXT, fontSize: 24, fontWeight: 900 }}>
              <span style={{ color: GREEN }}>{test.count}</span>
              <span style={{ color: TEXT_DIM }}>/</span>
              <span>{test.total}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Floating geometric shapes (AnimStats style)
const FloatingShapes: React.FC<{ frame: number; dark?: boolean }> = ({ frame, dark = true }) => {
  const shapes = Array.from({ length: 8 }, (_, i) => ({
    x: random(`s-x-${i}`) * 100,
    y: random(`s-y-${i}`) * 100,
    size: 30 + random(`s-size-${i}`) * 50,
    rotation: random(`s-rot-${i}`) * 360,
    isCircle: i % 2 === 0,
  }));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {shapes.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            // Slow rotation and drift (AnimStats style)
            transform: `translateY(${Math.sin((frame + i * 20) * 0.015) * 12}px) rotate(${s.rotation + frame * 0.03}deg)`,
            border: `2px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"}`,
            borderRadius: s.isCircle ? "50%" : 0,
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
};

// Confetti
const Confetti: React.FC<{ frame: number; fps: number; startFrame: number }> = ({ frame, fps, startFrame }) => {
  const localFrame = frame - startFrame;
  if (localFrame < 0 || localFrame > fps * 1.5) return null;

  const particles = Array.from({ length: 25 }, (_, i) => ({
    angle: (i / 25) * Math.PI * 2,
    speed: 150 + random(`c-s-${i}`) * 200,
    color: [PURPLE, PINK, YELLOW, GREEN, CYAN][i % 5],
    size: 6 + random(`c-sz-${i}`) * 6,
  }));

  const progress = localFrame / fps;
  const gravity = progress * progress * 300;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: random(`c-r-${i}`) > 0.5 ? "50%" : 2,
            transform: `translate(${Math.cos(p.angle) * p.speed * progress}px, ${Math.sin(p.angle) * p.speed * progress + gravity}px)`,
            opacity: interpolate(localFrame, [fps, fps * 1.5], [1, 0], { extrapolateLeft: "clamp" }),
          }}
        />
      ))}
    </div>
  );
};

// SkillScene - rapid montage component for quick skill demos (FIXED: smaller text, one-line command)
const SkillScene: React.FC<{
  frame: number;
  fps: number;
  command: string;
  description: string;
  result: string;
  phase: keyof typeof PHASE_COLORS;
  icon: string;
}> = ({ frame, fps, command, description, result, phase, icon }) => {
  const scale = spring({ frame, fps, config: OVERSHOOT });
  const resultOpacity = interpolate(frame, [fps * 0.8, fps * 1.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 40 }}>
      <TerminalWindow
        title="Claude Code"
        phase={phase}
        style={{ flex: 1 }}
        frame={frame}
        fps={fps}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {/* Command - FIXED: smaller font, always one line */}
          <div style={{ marginBottom: 20, whiteSpace: "nowrap" }}>
            <span style={{ color: GREEN, fontSize: 18 }}>$ </span>
            <span style={{ color: PHASE_COLORS[phase], fontWeight: 700, fontSize: 18 }}>{command}</span>
            <span style={{ color: TEXT_DIM, fontSize: 14, marginLeft: 12 }}>{description}</span>
          </div>

          {/* Icon + Output */}
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 20,
            backgroundColor: SURFACE_LIGHT,
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 36 }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: TEXT, fontSize: 15, lineHeight: 1.5 }}>
                Processing {command.replace("/", "")}...
              </div>
            </div>
          </div>

          {/* Result - compact */}
          <div style={{
            opacity: resultOpacity,
            backgroundColor: `${GREEN}10`,
            border: `1px solid ${GREEN}`,
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <span style={{ color: GREEN, fontSize: 18 }}>✓</span>
            <span style={{ color: TEXT, fontSize: 14 }}>{result}</span>
          </div>
        </div>
      </TerminalWindow>
    </div>
  );
};

// Main Component
export const MarketplaceDemo: React.FC<MarketplaceDemoProps> = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Scene boundaries (45s total = 1350 frames @ 30fps)
  // AnimStats-style hook with "Are you ready?" sequence
  const HOOK_END = fps * 5; // 0-5s (AnimStats intro)
  const EXPLORE_END = fps * 8; // 5-8s
  const BRAINSTORM_END = fps * 11; // 8-11s
  const IMPLEMENT_END = fps * 21; // 11-21s (10s hero section)
  const VERIFY_END = fps * 28; // 21-28s (7s)
  const COMMIT_END = fps * 31; // 28-31s
  const REVIEW_END = fps * 34; // 31-34s
  const FIX_END = fps * 37; // 34-37s
  const REMEMBER_END = fps * 40; // 37-40s
  // CTA: 40-45s (fps * 40 to fps * 45)

  const isHook = frame < HOOK_END;
  const isExplore = frame >= HOOK_END && frame < EXPLORE_END;
  const isBrainstorm = frame >= EXPLORE_END && frame < BRAINSTORM_END;
  const isImplement = frame >= BRAINSTORM_END && frame < IMPLEMENT_END;
  const isVerify = frame >= IMPLEMENT_END && frame < VERIFY_END;
  const isCommit = frame >= VERIFY_END && frame < COMMIT_END;
  const isReview = frame >= COMMIT_END && frame < REVIEW_END;
  const isFix = frame >= REVIEW_END && frame < FIX_END;
  const isRemember = frame >= FIX_END && frame < REMEMBER_END;
  const isCTA = frame >= REMEMBER_END;

  // Hard contrast slam for CTA (sudden cut from dark to white)
  const bgColor = isCTA ? WHITE : isHook ? WHITE : BLACK;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <FloatingShapes frame={frame} dark={bgColor === BLACK} />

      {isHook && <HookScene frame={frame} fps={fps} />}
      {isExplore && <SkillScene frame={frame - HOOK_END} fps={fps} command="/explore" description="Analyzing codebase structure" result="Found 23 React components, 8 custom hooks, 12 API routes" phase="UNDERSTAND" icon="🔍" />}
      {isBrainstorm && <SkillScene frame={frame - EXPLORE_END} fps={fps} command="/brainstorming" description="Generating implementation approaches" result="12 approaches generated, 3 recommended for JWT auth" phase="PLAN" icon="💡" />}
      {isImplement && <ImplementScene frame={frame - BRAINSTORM_END} fps={fps} width={width} height={height} />}
      {isVerify && <VerifyScene frame={frame - IMPLEMENT_END} fps={fps} />}
      {isCommit && <SkillScene frame={frame - VERIFY_END} fps={fps} command="/commit" description="Creating semantic commit message" result='feat(auth): add JWT authentication with refresh tokens' phase="SHIP" icon="📦" />}
      {isReview && <SkillScene frame={frame - COMMIT_END} fps={fps} command="/review-pr" description="6 verification agents analyzing 487 lines" result="Approved - Security: 9.5, Quality: 9.2, Coverage: 94%" phase="REVIEW" icon="👀" />}
      {isFix && <SkillScene frame={frame - REVIEW_END} fps={fps} command="/fix-issue" description="Analyzing issue #42: Token expiry edge case" result="Fixed refresh token race condition, added retry logic" phase="ITERATE" icon="🔧" />}
      {isRemember && <SkillScene frame={frame - FIX_END} fps={fps} command="/remember" description="Storing pattern for future sessions" result="Learned: JWT refresh pattern with race condition guard" phase="LEARN" icon="🧠" />}
      {isCTA && <CTAScene frame={frame - REMEMBER_END} fps={fps} />}

      {/* Progress bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, backgroundColor: bgColor === BLACK ? "#222" : "#ddd" }}>
        <div style={{
          height: "100%",
          width: `${interpolate(frame, [0, fps * 40], [0, 100], { extrapolateRight: "clamp" })}%`,
          background: `linear-gradient(90deg, ${PURPLE}, ${PINK}, ${YELLOW})`,
        }} />
      </div>
    </AbsoluteFill>
  );
};

// Scene 1: Hook (0-5s) - AnimStats style "Are you ready?" sequence
const HookScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  // AnimStats timing breakdown (5 seconds total):
  // 0-0.5s: "ARE YOU" slam (white bg, black text)
  // 0.5-1s: "READY?" slam
  // 1-2s: Contrast slam to black, glitch text "179 SKILLS"
  // 2-3.5s: Countdown 1,2,3,4 with beat
  // 3.5-5s: Logo reveal "ORCHESTKIT" with stats

  const phase1End = fps * 0.5;   // "ARE YOU"
  const phase2End = fps * 1;     // "READY?"
  const phase3End = fps * 2;     // Glitch stats
  const phase4End = fps * 3.5;   // Countdown
  // phase5: Logo reveal (3.5-5s)

  const isPhase1 = frame < phase1End;
  const isPhase2 = frame >= phase1End && frame < phase2End;
  const isPhase3 = frame >= phase2End && frame < phase3End;
  const isPhase4 = frame >= phase3End && frame < phase4End;
  const isPhase5 = frame >= phase4End;

  // Background: white for phases 1-2, black for phases 3-5
  const bgColor = (isPhase1 || isPhase2) ? WHITE : BLACK;
  const textColor = (isPhase1 || isPhase2) ? BLACK : WHITE;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <FloatingShapes frame={frame} dark={bgColor === BLACK} />
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        fontFamily: "Inter, SF Pro Display, sans-serif",
      }}>

        {/* Phase 1: "ARE YOU" - spring scale slam */}
        {isPhase1 && (
          <div style={{
            transform: `scale(${spring({ frame, fps, config: { damping: 8, stiffness: 300 } })})`,
            fontSize: 140,
            fontWeight: 900,
            color: textColor,
            letterSpacing: -4,
          }}>
            ARE YOU
          </div>
        )}

        {/* Phase 2: "READY?" - spring scale slam */}
        {isPhase2 && (
          <div style={{
            transform: `scale(${spring({ frame: frame - phase1End, fps, config: { damping: 8, stiffness: 300 } })})`,
            fontSize: 160,
            fontWeight: 900,
            color: textColor,
            letterSpacing: -4,
          }}>
            READY?
          </div>
        )}

        {/* Phase 3: Glitch stat reveal on black bg */}
        {isPhase3 && (
          <div style={{ textAlign: "center" }}>
            {/* Glitch echo effect - multiple layers with offset */}
            <div style={{ position: "relative" }}>
              <div style={{
                fontSize: 120,
                fontWeight: 900,
                color: PURPLE,
                opacity: 0.3,
                position: "absolute",
                transform: `translateY(-8px) scale(${spring({ frame: frame - phase2End, fps, config: POP })})`,
              }}>
                {ORCHESTKIT_STATS.skills} SKILLS
              </div>
              <div style={{
                fontSize: 120,
                fontWeight: 900,
                color: PINK,
                opacity: 0.3,
                position: "absolute",
                transform: `translateY(8px) scale(${spring({ frame: frame - phase2End, fps, config: POP })})`,
              }}>
                {ORCHESTKIT_STATS.skills} SKILLS
              </div>
              <div style={{
                fontSize: 120,
                fontWeight: 900,
                transform: `scale(${spring({ frame: frame - phase2End, fps, config: POP })})`,
              }}>
                <GradientText>{ORCHESTKIT_STATS.skills} SKILLS</GradientText>
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: Countdown 1,2,3,4 */}
        {isPhase4 && (() => {
          const countdownFrame = frame - phase3End;
          const countdownDuration = phase4End - phase3End;
          const numberIndex = Math.min(3, Math.floor((countdownFrame / countdownDuration) * 4));
          const numbers = ["1", "2", "3", "4"];
          const colors = [PURPLE, PINK, YELLOW, GREEN];
          const localFrame = countdownFrame - (numberIndex * countdownDuration / 4);

          return (
            <div style={{
              fontSize: 200,
              fontWeight: 900,
              color: colors[numberIndex],
              transform: `scale(${spring({ frame: localFrame, fps, config: { damping: 10, stiffness: 400 } })})`,
              fontFamily: "SF Mono, monospace",
            }}>
              {numbers[numberIndex]}
            </div>
          );
        })()}

        {/* Phase 5: Logo reveal with stats */}
        {isPhase5 && (
          <div style={{ textAlign: "center" }}>
            {/* Logo */}
            <div style={{
              transform: `scale(${spring({ frame: frame - phase4End, fps, config: OVERSHOOT })})`,
              marginBottom: 40,
            }}>
              <GradientText style={{ fontSize: 100, fontWeight: 900, display: "block", marginBottom: 12 }}>
                ORCHESTKIT
              </GradientText>
              <div style={{ color: TEXT_DIM, fontSize: 28, fontWeight: 500 }}>
                Claude Code, supercharged.
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 60, justifyContent: "center" }}>
              {[
                { value: ORCHESTKIT_STATS.skills, label: "Skills", color: PURPLE },
                { value: ORCHESTKIT_STATS.agents, label: "Agents", color: PINK },
                { value: ORCHESTKIT_STATS.hooks, label: "Hooks", color: YELLOW },
              ].map((stat, idx) => {
                const delay = idx * fps * 0.1;
                const statFrame = frame - phase4End - delay;
                if (statFrame <= 0) return <div key={idx} style={{ width: 100 }} />;

                const popScale = spring({ frame: statFrame, fps, config: POP });

                return (
                  <div key={idx} style={{ textAlign: "center", transform: `scale(${popScale})` }}>
                    <div style={{ fontSize: 56, fontWeight: 900, color: stat.color, fontFamily: "SF Mono, monospace" }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 14, color: TEXT_DIM, fontWeight: 600, letterSpacing: 2, marginTop: 4 }}>
                      {stat.label.toUpperCase()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Scene 2: Implement (8-18s) - BUILD phase, hero section
const ImplementScene: React.FC<{ frame: number; fps: number; width: number; height: number }> = ({ frame, fps }) => {
  const PAGE_DURATION = fps * 3.3; // ~3.3s per page for 10s total
  const currentPage = Math.min(2, Math.floor(frame / PAGE_DURATION));
  const pageFrame = frame % PAGE_DURATION;

  const AGENTS = [
    { icon: "🏗️", name: "backend-architect", task: "Designing REST endpoints", color: CYAN },
    { icon: "🔒", name: "security-auditor", task: "Validating JWT patterns", color: RED },
    { icon: "📊", name: "workflow-architect", task: "Planning dependencies", color: PURPLE },
    { icon: "🧪", name: "test-generator", task: "Creating test fixtures", color: GREEN },
  ];

  const FILES = [
    { path: "src/api/auth.py", isNew: true },
    { path: "src/api/users.py", isNew: true },
    { path: "src/models/user.py", isNew: true },
    { path: "src/utils/jwt.py", isNew: true },
    { path: "tests/test_auth.py", isNew: true },
  ];

  const CODE_LINES = [
    { code: '@router.post("/login")', color: PURPLE },
    { code: 'async def login(creds: LoginSchema):', color: CYAN },
    { code: '    """Authenticate and return JWT."""', color: TEXT_DIM },
    { code: '    user = await authenticate(creds)', color: TEXT },
    { code: '    if not user:', color: TEXT },
    { code: '        raise HTTPException(401)', color: RED },
    { code: '    return create_tokens(user.id)', color: GREEN },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 40 }}>
      <TerminalWindow title="Claude Code — /implement" phase="BUILD" style={{ flex: 1 }} frame={frame} fps={fps}>
        {/* Command */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ color: GREEN }}>$ </span>
          <span style={{ color: PURPLE }}>/implement</span>
          <span style={{ color: TEXT }}> user authentication with JWT</span>
        </div>

        {/* Task box */}
        <TaskBox
          id={47}
          title="Implement user authentication with JWT"
          status={currentPage === 2 ? "complete" : "running"}
          frame={frame}
        />

        {/* Page 1: Agents working */}
        {currentPage === 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ color: TEXT_DIM, fontSize: 14, marginBottom: 16 }}>Spawning specialized agents...</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {AGENTS.map((agent, idx) => {
                const agentDelay = idx * fps * 0.25;
                const agentFrame = pageFrame - agentDelay;
                if (agentFrame <= 0) return <div key={idx} />;

                // Clamped progress calculation (AnimStats fix)
                const progress = interpolate(agentFrame, [0, fps * 2.5], [0, 100], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const scale = spring({ frame: agentFrame, fps, config: SNAPPY });

                return (
                  <div key={idx} style={{ transform: `scale(${scale})` }}>
                    <AgentCard
                      icon={agent.icon}
                      name={agent.name}
                      task={agent.task}
                      progress={progress}
                      color={agent.color}
                      frame={frame}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Page 2: Files + Code */}
        {currentPage === 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, marginTop: 20 }}>
            <FileTree files={FILES} visibleCount={Math.min(5, Math.floor(pageFrame / (fps * 0.25)))} />
            <CodePreview
              filename="src/api/auth.py"
              lines={CODE_LINES}
              typedLines={Math.min(7, Math.floor(pageFrame / (fps * 0.4)))}
            />
          </div>
        )}

        {/* Page 3: Complete with test breakdown */}
        {currentPage === 2 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, position: "relative" }}>
            <Confetti frame={frame} fps={fps} startFrame={fps * 6.6} />
            <div style={{ fontSize: 80, transform: `scale(${spring({ frame: pageFrame, fps, config: POP })})`, marginBottom: 20, color: GREEN }}>✓</div>
            <GradientText style={{ fontSize: 48, fontWeight: 900, marginBottom: 20 }}>Build Complete</GradientText>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 60, marginBottom: 20 }}>
              {[
                { value: "6", label: "Files", color: PURPLE },
                { value: "487", label: "Lines", color: PINK },
              ].map((stat, idx) => (
                <div key={idx} style={{ textAlign: "center", transform: `scale(${spring({ frame: Math.max(0, pageFrame - idx * fps * 0.1), fps, config: POP })})` }}>
                  <div style={{ fontSize: 48, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 14, color: TEXT_DIM, marginTop: 8 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Test results breakdown (UNIT/INTEGRATION/E2E) */}
            <TestResults frame={pageFrame} fps={fps} />
          </div>
        )}
      </TerminalWindow>
    </div>
  );
};

// Scene 3: Verify (18-25s) - QUALITY phase
const VerifyScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const DIMENSIONS = [
    { icon: "🔒", name: "Security", score: 9.5, detail: "OWASP Top 10 compliant", color: RED },
    { icon: "🧪", name: "Test Coverage", score: 9.4, detail: "94% coverage, 12/12 passing", color: CYAN },
    { icon: "📊", name: "Code Quality", score: 9.2, detail: "0 lint errors, clean patterns", color: PURPLE },
    { icon: "⚡", name: "Performance", score: 9.1, detail: "<50ms latency, optimized", color: YELLOW },
    { icon: "♿", name: "Accessibility", score: 8.5, detail: "WCAG 2.2 AA compliant", color: BLUE },
    { icon: "📝", name: "Documentation", score: 9.0, detail: "OpenAPI spec generated", color: PINK },
  ];

  const visibleRows = Math.min(6, Math.floor(frame / (fps * 0.4)));
  const showComposite = frame >= fps * 4;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 40 }}>
      <TerminalWindow title="Claude Code — /verify" phase="QUALITY" style={{ flex: 1 }} frame={frame} fps={fps}>
        <div style={{ marginBottom: 20 }}>
          <span style={{ color: GREEN }}>$ </span>
          <span style={{ color: GREEN }}>/verify</span>
          <span style={{ color: TEXT }}> authentication</span>
        </div>

        <div style={{ marginBottom: 20, color: TEXT_DIM, fontSize: 14 }}>
          Running 6 verification agents in parallel...
        </div>

        <VerificationTable
          dimensions={DIMENSIONS}
          visibleRows={visibleRows}
          showComposite={showComposite}
          compositeScore={8.9}
        />

        {showComposite && (
          <div style={{
            marginTop: 20,
            backgroundColor: `${GREEN}15`,
            border: `2px solid ${GREEN}`,
            borderRadius: 12,
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            transform: `scale(${spring({ frame: frame - fps * 4, fps, config: POP })})`,
          }}>
            <span style={{ fontSize: 32 }}>🚀</span>
            <span style={{ color: GREEN, fontSize: 28, fontWeight: 800 }}>READY FOR MERGE</span>
          </div>
        )}
      </TerminalWindow>
    </div>
  );
};

// Scene 4: CTA (37-40s) - Hard contrast slam to white background
const CTAScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const scale = spring({ frame, fps, config: POP });
  const ctaScale = spring({ frame: Math.max(0, frame - fps * 0.5), fps, config: POP });

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      fontFamily: "Inter, SF Pro Display, sans-serif",
      // Hard contrast slam - white background
      backgroundColor: WHITE,
    }}>
      <FloatingShapes frame={frame} dark={false} />

      <div style={{ textAlign: "center", transform: `scale(${scale})`, marginBottom: 40, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: BLACK, marginBottom: 12 }}>
          Works with your existing projects.
        </div>
        <div style={{ fontSize: 20, color: TEXT_DIM }}>
          No config. No lock-in. Just results.
        </div>
      </div>

      <div style={{
        transform: `scale(${ctaScale})`,
        background: `linear-gradient(135deg, ${PURPLE}, ${PINK})`,
        borderRadius: 16,
        padding: "28px 56px",
        boxShadow: `0 20px 60px ${PURPLE}40`,
        marginBottom: 40,
        position: "relative",
        zIndex: 1,
      }}>
        <span style={{ color: WHITE, fontSize: 32, fontWeight: 800, fontFamily: "SF Mono, monospace" }}>
          $ /plugin install ork
        </span>
      </div>

      {/* Social proof */}
      <div style={{
        display: "flex",
        gap: 40,
        opacity: interpolate(frame, [fps * 1.5, fps * 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        position: "relative",
        zIndex: 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>⭐</span>
          <span style={{ color: BLACK, fontWeight: 600 }}>2.4k GitHub stars</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>⬇️</span>
          <span style={{ color: BLACK, fontWeight: 600 }}>15k+ installs</span>
        </div>
      </div>

      <div style={{
        marginTop: 40,
        opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        position: "relative",
        zIndex: 1,
      }}>
        <GradientText style={{ fontSize: 32, fontWeight: 900, letterSpacing: 4 }}>ORCHESTKIT</GradientText>
      </div>
    </div>
  );
};
