import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  random,
} from "remotion";
import { z } from "zod";
import { ORCHESTKIT_STATS } from "../constants";

/**
 * MarketplaceDemo v4 - Complete Redesign
 *
 * 50 seconds @ 30fps = 1500 frames
 * Features: Real terminal UI, proper agent cards, verification report table
 */

export const marketplaceDemoSchema = z.object({
  primaryColor: z.string().default("#9B5DE5"),
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
const YELLOW = "#fbbf24";
const GREEN = "#22c55e";
const CYAN = "#06b6d4";
const RED = "#ef4444";
const BLUE = "#3b82f6";
const ORANGE = "#f97316";

// Spring configs
const SNAPPY = { damping: 12, stiffness: 200 };
const POP = { damping: 10, stiffness: 300, mass: 0.8 };
const BOUNCE = { damping: 8, stiffness: 180 };

// Gradient text
const GradientText: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <span style={{
    background: `linear-gradient(90deg, ${PURPLE} 0%, ${PINK} 50%, ${YELLOW} 100%)`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    ...style,
  }}>
    {children}
  </span>
);

// Terminal Window Component
const TerminalWindow: React.FC<{
  children: React.ReactNode;
  title?: string;
  style?: React.CSSProperties;
}> = ({ children, title = "Claude Code", style }) => (
  <div style={{
    backgroundColor: SURFACE,
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
    ...style,
  }}>
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
  fps: number;
}> = ({ id, title, status, frame, fps }) => {
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

// Agent Card Component (Redesigned)
const AgentCard: React.FC<{
  icon: string;
  name: string;
  task: string;
  progress: number;
  color: string;
  frame: number;
  fps: number;
}> = ({ icon, name, task, progress, color, frame, fps }) => {
  const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const spinnerIdx = Math.floor(frame / 3) % SPINNER.length;
  const isDone = progress >= 100;

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
        <div style={{ flex: 1, height: 8, backgroundColor: BORDER, borderRadius: 4 }}>
          <div style={{
            height: "100%",
            width: `${Math.min(100, progress)}%`,
            backgroundColor: isDone ? GREEN : color,
            borderRadius: 4,
            transition: "width 0.3s",
          }} />
        </div>
        <span style={{ color: isDone ? GREEN : TEXT_DIM, fontSize: 13, minWidth: 50 }}>
          {isDone ? "✓ Done" : `${SPINNER[spinnerIdx]} ${Math.floor(progress)}%`}
        </span>
      </div>
    </div>
  );
};

// File Tree Component
const FileTree: React.FC<{ files: { path: string; isNew?: boolean }[]; visibleCount: number }> = ({ files, visibleCount }) => (
  <div style={{ backgroundColor: SURFACE_LIGHT, borderRadius: 8, padding: 16 }}>
    <div style={{ color: TEXT_DIM, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>📁 FILES CREATED</div>
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
        <span style={{ color: GREEN, fontWeight: 600 }}>Grade: A • Ready for merge</span>
      </div>
    )}
  </div>
);

// Floating shapes background
const FloatingShapes: React.FC<{ frame: number; dark?: boolean }> = ({ frame, dark = true }) => {
  const shapes = Array.from({ length: 6 }, (_, i) => ({
    x: random(`s-x-${i}`) * 100,
    y: random(`s-y-${i}`) * 100,
    size: 30 + random(`s-size-${i}`) * 40,
    rotation: random(`s-rot-${i}`) * 360,
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
            transform: `translateY(${Math.sin((frame + i * 20) * 0.02) * 8}px) rotate(${s.rotation + frame * 0.05}deg)`,
            border: `2px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}`,
            borderRadius: i % 2 === 0 ? "50%" : 0,
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

// Main Component
export const MarketplaceDemo: React.FC<MarketplaceDemoProps> = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Scene boundaries (50s total)
  const HOOK_END = fps * 5;
  const IMPLEMENT_END = fps * 22;
  const VERIFY_INTRO_END = fps * 23;
  const VERIFY_END = fps * 33;
  const BREADTH_INTRO_END = fps * 34;
  const BREADTH_END = fps * 42;
  const CTA_INTRO_END = fps * 43;

  const isHook = frame < HOOK_END;
  const isImplement = frame >= HOOK_END && frame < IMPLEMENT_END;
  const isVerifyIntro = frame >= IMPLEMENT_END && frame < VERIFY_INTRO_END;
  const isVerify = frame >= VERIFY_INTRO_END && frame < VERIFY_END;
  const isBreadthIntro = frame >= VERIFY_END && frame < BREADTH_INTRO_END;
  const isBreadth = frame >= BREADTH_INTRO_END && frame < BREADTH_END;
  const isCTAIntro = frame >= BREADTH_END && frame < CTA_INTRO_END;
  const isCTA = frame >= CTA_INTRO_END;

  const bgColor = isHook || isCTA ? WHITE : isVerifyIntro || isBreadthIntro || isCTAIntro ? WHITE : BLACK;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <FloatingShapes frame={frame} dark={bgColor === BLACK} />

      {isHook && <HookScene frame={frame} fps={fps} />}
      {isImplement && <ImplementScene frame={frame - HOOK_END} fps={fps} width={width} height={height} />}
      {isVerifyIntro && <IntroCard frame={frame - IMPLEMENT_END} fps={fps} title="Quality Gate" subtitle="/verify" icon="🔍" />}
      {isVerify && <VerifyScene frame={frame - VERIFY_INTRO_END} fps={fps} />}
      {isBreadthIntro && <IntroCard frame={frame - VERIFY_END} fps={fps} title="22 Skills" subtitle="ecosystem" icon="⚡" />}
      {isBreadth && <BreadthScene frame={frame - BREADTH_INTRO_END} fps={fps} />}
      {isCTAIntro && <IntroCard frame={frame - BREADTH_END} fps={fps} title="Get Started" subtitle="one command" icon="🚀" />}
      {isCTA && <CTAScene frame={frame - CTA_INTRO_END} fps={fps} />}

      {/* Progress bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, backgroundColor: bgColor === BLACK ? "#222" : "#ddd" }}>
        <div style={{
          height: "100%",
          width: `${(frame / (fps * 50)) * 100}%`,
          background: `linear-gradient(90deg, ${PURPLE}, ${PINK}, ${YELLOW})`,
        }} />
      </div>
    </AbsoluteFill>
  );
};

// Scene 1: Hook (0-5s)
const HookScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const phase1End = fps * 1.5;
  const phase2End = fps * 3;

  const isPhase1 = frame < phase1End;
  const isPhase2 = frame >= phase1End && frame < phase2End;
  const isPhase3 = frame >= phase2End;

  return (
    <AbsoluteFill style={{ backgroundColor: isPhase2 ? BLACK : WHITE }}>
      <FloatingShapes frame={frame} dark={isPhase2} />
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        fontFamily: "Inter, SF Pro Display, sans-serif",
      }}>
        {isPhase1 && (
          <div style={{
            fontSize: 60,
            fontWeight: 900,
            color: BLACK,
            textAlign: "center",
            transform: `scale(${spring({ frame, fps, config: POP })})`,
            lineHeight: 1.2,
          }}>
            How many lines did you<br />
            <span style={{ color: RED }}>explain</span> instead of <span style={{ color: GREEN }}>ship</span>?
          </div>
        )}

        {isPhase2 && (
          <div style={{
            textAlign: "center",
            transform: `scale(${spring({ frame: frame - phase1End, fps, config: POP })})`,
          }}>
            <GradientText style={{ fontSize: 90, fontWeight: 900, display: "block", marginBottom: 20 }}>
              ORCHESTKIT
            </GradientText>
            <div style={{ color: TEXT_DIM, fontSize: 28, fontWeight: 500 }}>
              Claude Code, supercharged.
            </div>
          </div>
        )}

        {isPhase3 && (
          <div style={{ display: "flex", gap: 80, transform: `scale(${spring({ frame: frame - phase2End, fps, config: POP })})` }}>
            {[
              { value: ORCHESTKIT_STATS.skills, label: "Skills", color: PURPLE },
              { value: ORCHESTKIT_STATS.agents, label: "Agents", color: PINK },
              { value: ORCHESTKIT_STATS.hooks, label: "Hooks", color: YELLOW },
            ].map((stat, idx) => {
              const delay = idx * fps * 0.1;
              const statFrame = frame - phase2End - delay;
              const countUp = Math.min(Math.floor(interpolate(statFrame, [0, fps * 0.6], [0, stat.value], {
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              })), stat.value);

              return (
                <div key={idx} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 72, fontWeight: 900, color: stat.color, fontFamily: "SF Mono, monospace" }}>
                    {countUp}
                  </div>
                  <div style={{ fontSize: 18, color: BLACK, fontWeight: 600, letterSpacing: 2, marginTop: 8 }}>
                    {stat.label.toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Intro Card
const IntroCard: React.FC<{ frame: number; fps: number; title: string; subtitle: string; icon: string }> = ({ frame, fps, title, subtitle, icon }) => {
  const scale = spring({ frame, fps, config: POP });
  const iconBounce = spring({ frame: Math.max(0, frame - fps * 0.1), fps, config: BOUNCE });

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      fontFamily: "Inter, SF Pro Display, sans-serif",
      transform: `scale(${scale})`,
    }}>
      <div style={{ fontSize: 120, transform: `scale(${iconBounce}) rotate(${Math.sin(frame * 0.3) * 6}deg)`, marginBottom: 24 }}>
        {icon}
      </div>
      <div style={{ fontSize: 64, fontWeight: 900, color: BLACK, marginBottom: 12 }}>{title}</div>
      <GradientText style={{ fontSize: 28, fontWeight: 600 }}>{subtitle}</GradientText>
    </div>
  );
};

// Scene 2: Implement (5-22s) - REDESIGNED
const ImplementScene: React.FC<{ frame: number; fps: number; width: number; height: number }> = ({ frame, fps }) => {
  const PAGE_DURATION = fps * 5.5;
  const currentPage = Math.min(2, Math.floor(frame / PAGE_DURATION));
  const pageFrame = frame % PAGE_DURATION;

  const AGENTS = [
    { icon: "🏗️", name: "backend-architect", task: "Designing REST endpoints", color: CYAN },
    { icon: "🔒", name: "security-auditor", task: "Validating JWT patterns", color: RED },
    { icon: "📊", name: "workflow-architect", task: "Planning dependencies", color: PURPLE },
    { icon: "🧪", name: "test-generator", task: "Creating fixtures", color: GREEN },
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
    { code: 'async def login(credentials: LoginSchema):', color: CYAN },
    { code: '    """Authenticate user and return JWT."""', color: TEXT_DIM },
    { code: '    user = await authenticate(credentials)', color: TEXT },
    { code: '    if not user:', color: TEXT },
    { code: '        raise HTTPException(401, "Invalid")', color: RED },
    { code: '    return create_jwt_tokens(user.id)', color: GREEN },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 40 }}>
      <TerminalWindow title="Claude Code — /implement" style={{ flex: 1 }}>
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
          fps={fps}
        />

        {/* Page 1: Agents working */}
        {currentPage === 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ color: TEXT_DIM, fontSize: 14, marginBottom: 16 }}>Spawning specialized agents...</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {AGENTS.map((agent, idx) => {
                const agentDelay = idx * fps * 0.3;
                const agentFrame = pageFrame - agentDelay;
                if (agentFrame <= 0) return <div key={idx} />;

                const progress = Math.min(100, (agentFrame / (fps * 3)) * 100);
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
                      fps={fps}
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
            <FileTree files={FILES} visibleCount={Math.min(5, Math.floor(pageFrame / (fps * 0.3)))} />
            <CodePreview
              filename="src/api/auth.py"
              lines={CODE_LINES}
              typedLines={Math.min(7, Math.floor(pageFrame / (fps * 0.5)))}
            />
          </div>
        )}

        {/* Page 3: Complete */}
        {currentPage === 2 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, position: "relative" }}>
            <Confetti frame={frame} fps={fps} startFrame={HOOK_END + PAGE_DURATION * 2} />
            <div style={{ fontSize: 80, transform: `scale(${spring({ frame: pageFrame, fps, config: POP })})`, marginBottom: 20 }}>✓</div>
            <GradientText style={{ fontSize: 48, fontWeight: 900, marginBottom: 30 }}>Task Complete</GradientText>
            <div style={{ display: "flex", gap: 60 }}>
              {[
                { value: "6", label: "Files", color: PURPLE },
                { value: "487", label: "Lines", color: PINK },
                { value: "12", label: "Tests", color: GREEN },
              ].map((stat, idx) => (
                <div key={idx} style={{ textAlign: "center", transform: `scale(${spring({ frame: Math.max(0, pageFrame - idx * fps * 0.1), fps, config: POP })})` }}>
                  <div style={{ fontSize: 48, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 14, color: TEXT_DIM, marginTop: 8 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </TerminalWindow>
    </div>
  );
};

// Scene 3: Verify (23-33s) - REDESIGNED
const VerifyScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const DIMENSIONS = [
    { icon: "🔒", name: "Security", score: 9.5, detail: "OWASP Top 10 compliant", color: RED },
    { icon: "🧪", name: "Test Coverage", score: 9.4, detail: "94% coverage, 12/12 passing", color: CYAN },
    { icon: "📊", name: "Code Quality", score: 9.2, detail: "0 lint errors, clean patterns", color: PURPLE },
    { icon: "⚡", name: "Performance", score: 9.1, detail: "<50ms latency, optimized", color: YELLOW },
    { icon: "♿", name: "Accessibility", score: 8.5, detail: "WCAG 2.2 AA compliant", color: BLUE },
    { icon: "📝", name: "Documentation", score: 9.0, detail: "OpenAPI spec generated", color: PINK },
  ];

  const visibleRows = Math.min(6, Math.floor(frame / (fps * 0.5)));
  const showComposite = frame >= fps * 5;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 40 }}>
      <TerminalWindow title="Claude Code — /verify" style={{ flex: 1 }}>
        <div style={{ marginBottom: 20 }}>
          <span style={{ color: GREEN }}>$ </span>
          <span style={{ color: PURPLE }}>/verify</span>
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
            transform: `scale(${spring({ frame: frame - fps * 5, fps, config: POP })})`,
          }}>
            <span style={{ fontSize: 32 }}>🚀</span>
            <span style={{ color: GREEN, fontSize: 28, fontWeight: 800 }}>READY FOR MERGE</span>
          </div>
        )}
      </TerminalWindow>
    </div>
  );
};

// Scene 4: Breadth (34-42s)
const BreadthScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const COMMANDS = [
    { cmd: "/explore", result: "Found 23 React components, 8 custom hooks", color: PURPLE },
    { cmd: "/brainstorming", result: "Generated 12 approaches for caching layer", color: YELLOW },
    { cmd: "/commit", result: 'feat(auth): add JWT authentication flow', color: PINK },
    { cmd: "/create-pr", result: "PR #143: User Authentication (6 files)", color: BLUE },
    { cmd: "/review-pr", result: "6 agents analyzed 487 lines → Approved", color: GREEN },
  ];

  const COMMAND_DURATION = fps * 1.5;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 40 }}>
      <TerminalWindow title="Claude Code — Skills Demo" style={{ flex: 1 }}>
        <div style={{ color: TEXT_DIM, fontSize: 16, marginBottom: 24, textAlign: "center" }}>
          22 user-invocable skills at your fingertips
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {COMMANDS.map((item, idx) => {
            const itemStart = idx * COMMAND_DURATION;
            const itemFrame = frame - itemStart;
            if (itemFrame <= 0) return null;

            const scale = spring({ frame: itemFrame, fps, config: SNAPPY });
            const showResult = itemFrame > fps * 0.4;

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "16px 24px",
                  backgroundColor: SURFACE_LIGHT,
                  borderRadius: 10,
                  border: `1px solid ${item.color}40`,
                  transform: `scale(${scale})`,
                }}
              >
                <span style={{ color: item.color, fontWeight: 700, fontSize: 20, minWidth: 180 }}>{item.cmd}</span>
                {showResult && (
                  <span style={{
                    color: TEXT,
                    fontSize: 16,
                    opacity: interpolate(itemFrame - fps * 0.4, [0, fps * 0.2], [0, 1]),
                  }}>
                    → {item.result}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </TerminalWindow>
    </div>
  );
};

// Scene 5: CTA (43-50s)
const CTAScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const scale = spring({ frame, fps, config: POP });
  const ctaScale = spring({ frame: Math.max(0, frame - fps * 1), fps, config: POP });

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      fontFamily: "Inter, SF Pro Display, sans-serif",
    }}>
      <div style={{ textAlign: "center", transform: `scale(${scale})`, marginBottom: 40 }}>
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
      }}>
        <span style={{ color: WHITE, fontSize: 32, fontWeight: 800, fontFamily: "SF Mono, monospace" }}>
          $ /plugin install ork
        </span>
      </div>

      {/* Social proof */}
      <div style={{
        display: "flex",
        gap: 40,
        opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1]),
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

      <div style={{ marginTop: 40, opacity: interpolate(frame, [fps * 3, fps * 3.5], [0, 1]) }}>
        <GradientText style={{ fontSize: 32, fontWeight: 900, letterSpacing: 4 }}>ORCHESTKIT</GradientText>
      </div>
    </div>
  );
};

// Export constant for other components
const HOOK_END = 30 * 5;
