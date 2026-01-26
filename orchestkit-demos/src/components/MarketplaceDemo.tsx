import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { z } from "zod";
import { ORCHESTKIT_STATS } from "../constants";

/**
 * MarketplaceDemo - "The Full Power Demo" (Option D)
 *
 * 55 seconds @ 30fps = 1650 frames
 * Resolution: 1920x1080 (16:9)
 *
 * Timeline (with scene intros):
 * 0-4s:    Hook - OrchestKit logo + "Stop explaining your stack. Start shipping." + stats
 * 4-22s:   /implement - 4 paginated views with command bar
 * 22-24s:  Verify Intro - "Quality Check" card
 * 24-34s:  /verify - 6 agents checking + grade reveal with command bar
 * 34-36s:  Breadth Intro - "22 User-Invocable Skills" card
 * 36-46s:  Breadth montage - Quick cuts of other commands
 * 46-48s:  CTA Intro - "Get Started" card
 * 48-55s:  CTA - Install command + ecosystem
 */

export const marketplaceDemoSchema = z.object({
  primaryColor: z.string().default("#a855f7"),
});

type MarketplaceDemoProps = z.infer<typeof marketplaceDemoSchema>;

// Colors (vibrant palette)
const BG = "#030712";
const SURFACE = "#0f172a";
const BORDER = "#334155";
const TEXT = "#f8fafc";
const DIM = "#94a3b8";
const GREEN = "#22c55e";
const PURPLE = "#a855f7";
const CYAN = "#06b6d4";
const _ORANGE = "#f97316"; // Reserved for future use
const YELLOW = "#eab308";
const PINK = "#ec4899";
const RED = "#ef4444";
const BLUE = "#3b82f6";

// Agent definitions for /implement
const IMPLEMENT_AGENTS = [
  { icon: "🏗️", name: "backend-architect", color: CYAN, task: "Designing auth endpoints" },
  { icon: "🔒", name: "security-auditor", color: RED, task: "Validating JWT patterns" },
  { icon: "📊", name: "workflow-architect", color: PURPLE, task: "Planning task dependencies" },
  { icon: "🧪", name: "test-generator", color: GREEN, task: "Creating test fixtures" },
  { icon: "📝", name: "docs-specialist", color: PINK, task: "Writing API docs" },
];

// Tasks for /implement
const IMPLEMENT_TASKS = [
  { id: 1, name: "Create auth endpoints", status: "completed" },
  { id: 2, name: "Add User model", status: "completed" },
  { id: 3, name: "Implement JWT utils", status: "completed" },
  { id: 4, name: "Add auth middleware", status: "completed" },
  { id: 5, name: "Write integration tests", status: "completed" },
  { id: 6, name: "Generate API docs", status: "completed" },
];

// Agents for /verify
const VERIFY_AGENTS = [
  { icon: "🔒", name: "Security", score: 9.5, color: RED },
  { icon: "🧪", name: "Tests", score: 9.2, color: CYAN },
  { icon: "📊", name: "Quality", score: 8.8, color: PURPLE },
  { icon: "⚡", name: "Performance", score: 9.1, color: YELLOW },
  { icon: "♿", name: "Accessibility", score: 8.5, color: BLUE },
  { icon: "📝", name: "Documentation", score: 9.0, color: PINK },
];

// Breadth montage commands
const BREADTH_COMMANDS = [
  { cmd: "/explore", result: "Architecture mapped • 847 files analyzed", color: PURPLE },
  { cmd: "/brainstorming", result: "3 agents → JWT + refresh tokens", color: YELLOW },
  { cmd: "/commit", result: "feat(auth): add JWT authentication", color: PINK },
  { cmd: "/create-pr", result: "PR #143 created → Ready for review", color: BLUE },
  { cmd: "/doctor", result: "All systems operational ✓", color: GREEN },
];

export const MarketplaceDemo: React.FC<MarketplaceDemoProps> = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Scene boundaries (in frames) - with intro cards
  const HOOK_END = fps * 4;
  const IMPLEMENT_END = fps * 22;
  const VERIFY_INTRO_END = fps * 24;
  const VERIFY_END = fps * 34;
  const BREADTH_INTRO_END = fps * 36;
  const BREADTH_END = fps * 46;
  const CTA_INTRO_END = fps * 48;
  // CTA: 48-55s

  // Determine current scene
  const isHook = frame < HOOK_END;
  const isImplement = frame >= HOOK_END && frame < IMPLEMENT_END;
  const isVerifyIntro = frame >= IMPLEMENT_END && frame < VERIFY_INTRO_END;
  const isVerify = frame >= VERIFY_INTRO_END && frame < VERIFY_END;
  const isBreadthIntro = frame >= VERIFY_END && frame < BREADTH_INTRO_END;
  const isBreadth = frame >= BREADTH_INTRO_END && frame < BREADTH_END;
  const isCTAIntro = frame >= BREADTH_END && frame < CTA_INTRO_END;
  const isCTA = frame >= CTA_INTRO_END;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isHook
            ? "radial-gradient(ellipse at center, #1e1b4b 0%, #030712 60%)"
            : isImplement
            ? "radial-gradient(ellipse at 30% 50%, #0c4a6e22 0%, #030712 50%)"
            : isVerify
            ? "radial-gradient(ellipse at 70% 50%, #14532d22 0%, #030712 50%)"
            : isBreadth
            ? "radial-gradient(ellipse at center, #1e1b4b22 0%, #030712 50%)"
            : "radial-gradient(ellipse at center, #1e1b4b 0%, #030712 60%)",
        }}
      />

      {/* Scene content */}
      {isHook && <HookScene frame={frame} fps={fps} />}
      {isImplement && <ImplementScene frame={frame - HOOK_END} fps={fps} width={width} />}
      {isVerifyIntro && <IntroCard frame={frame - IMPLEMENT_END} fps={fps} title="Quality Check" subtitle="/verify authentication" icon="🔍" color={GREEN} />}
      {isVerify && <VerifyScene frame={frame - VERIFY_INTRO_END} fps={fps} width={width} />}
      {isBreadthIntro && <IntroCard frame={frame - VERIFY_END} fps={fps} title="22 User-Invocable Skills" subtitle="Explore the ecosystem" icon="⚡" color={PURPLE} />}
      {isBreadth && <BreadthScene frame={frame - BREADTH_INTRO_END} fps={fps} />}
      {isCTAIntro && <IntroCard frame={frame - BREADTH_END} fps={fps} title="Get Started" subtitle="One command setup" icon="🚀" color={CYAN} />}
      {isCTA && <CTAScene frame={frame - CTA_INTRO_END} fps={fps} />}

      {/* Scene label badge */}
      {(isImplement || isVerify || isBreadth) && (
        <div
          style={{
            position: "absolute",
            top: 30,
            right: 40,
            backgroundColor: `${isImplement ? CYAN : isVerify ? GREEN : PURPLE}20`,
            border: `2px solid ${isImplement ? CYAN : isVerify ? GREEN : PURPLE}`,
            borderRadius: 30,
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: isImplement ? CYAN : isVerify ? GREEN : PURPLE, fontSize: 18, fontWeight: 700 }}>
            {isImplement ? "/implement" : isVerify ? "/verify" : "Skills"}
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundColor: "#1e293b",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(frame / (fps * 55)) * 100}%`,
            background: `linear-gradient(90deg, ${PURPLE} 0%, ${CYAN} 50%, ${GREEN} 100%)`,
            boxShadow: `0 0 10px ${CYAN}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// IntroCard - Animated intro between scenes
const IntroCard: React.FC<{
  frame: number;
  fps: number;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}> = ({ frame, fps, title, subtitle, icon, color }) => {
  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const opacity = interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: "clamp" });
  const iconScale = spring({ frame: Math.max(0, frame - fps * 0.2), fps, config: { damping: 15, stiffness: 150 } });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        opacity,
        transform: `scale(${scale})`,
        fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 100,
          marginBottom: 30,
          transform: `scale(${iconScale})`,
          textShadow: `0 0 60px ${color}60`,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: TEXT,
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 32,
          color: color,
          fontWeight: 600,
          fontFamily: "SF Mono, Monaco, Menlo, monospace",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};

// Scene 1: Hook (0-4s) - compressed
const HookScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const taglineOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: "clamp" });
  const taglineY = interpolate(frame, [0, fps * 0.3], [30, 0], { extrapolateRight: "clamp" });

  const statsOpacity = interpolate(frame, [fps * 0.8, fps * 1.2], [0, 1], { extrapolateRight: "clamp" });
  const statsScale = spring({ frame: Math.max(0, frame - fps * 0.8), fps, config: { damping: 12, stiffness: 100 } });

  const stats = [
    { value: ORCHESTKIT_STATS.skills, label: "skills", color: PURPLE },
    { value: ORCHESTKIT_STATS.agents, label: "agents", color: CYAN },
    { value: ORCHESTKIT_STATS.hooks, label: "hooks", color: GREEN },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Main tagline */}
      <div
        style={{
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          textAlign: "center",
          marginBottom: 60,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}
        >
          Stop explaining your stack.
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            background: `linear-gradient(90deg, ${PURPLE} 0%, ${CYAN} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: -1,
            lineHeight: 1.1,
          }}
        >
          Start shipping.
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          gap: 80,
          opacity: statsOpacity,
          transform: `scale(${statsScale})`,
        }}
      >
        {stats.map((stat, idx) => {
          const delay = idx * 3;
          const localFrame = Math.max(0, frame - fps * 1.3 - delay);
          const countUp = Math.min(
            Math.floor(interpolate(localFrame, [0, fps * 0.8], [0, stat.value], {
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            })),
            stat.value
          );

          return (
            <div key={idx} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 80,
                  fontWeight: 700,
                  color: stat.color,
                  fontFamily: "SF Mono, Monaco, Menlo, monospace",
                  textShadow: `0 0 40px ${stat.color}60`,
                }}
              >
                {countUp}
              </div>
              <div style={{ fontSize: 24, color: DIM, fontWeight: 500, letterSpacing: 2 }}>
                {stat.label.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Scene 2: /implement (4-22s) - 18s with 4 paginated views
const ImplementScene: React.FC<{ frame: number; fps: number; width: number }> = ({ frame, fps, width: _width }) => {
  const commandTyped = Math.min(Math.floor(frame * 2.5), "/implement user authentication".length);
  const showCommand = commandTyped > 0;

  // Page timing: 4.5s per page
  const PAGE_DURATION = fps * 4.5;
  const currentPage = Math.min(3, Math.floor(frame / PAGE_DURATION));
  const pageFrame = frame % PAGE_DURATION;

  // Page transitions
  const pageOpacity = interpolate(pageFrame, [0, fps * 0.3], [0, 1], { extrapolateRight: "clamp" });
  const pageSlideX = interpolate(pageFrame, [0, fps * 0.3], [30, 0], { extrapolateRight: "clamp" });

  // Spinner for active tasks
  const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const spinnerIdx = Math.floor(frame / 3) % SPINNER.length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "40px 60px",
        fontFamily: "SF Mono, Monaco, Menlo, monospace",
      }}
    >
      {/* Command bar at top - always visible */}
      <div
        style={{
          backgroundColor: SURFACE,
          borderRadius: 16,
          border: `2px solid ${CYAN}`,
          padding: "20px 30px",
          marginBottom: 20,
          boxShadow: `0 0 30px ${CYAN}20`,
        }}
      >
        {showCommand && (
          <div style={{ fontSize: 32, fontWeight: 600, display: "flex", alignItems: "center", gap: 20 }}>
            <div>
              <span style={{ color: GREEN }}>$ </span>
              <span style={{ color: CYAN }}>{"/implement user authentication".slice(0, commandTyped)}</span>
              {commandTyped < "/implement user authentication".length && (
                <span style={{ backgroundColor: TEXT, width: 3, height: 32, display: "inline-block", marginLeft: 2 }} />
              )}
            </div>
            {currentPage < 3 && (
              <span style={{ color: YELLOW, fontSize: 20 }}>{SPINNER[spinnerIdx]} Running...</span>
            )}
            {currentPage === 3 && (
              <span style={{ color: GREEN, fontSize: 20 }}>✓ Complete</span>
            )}
          </div>
        )}
      </div>

      {/* Page indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, justifyContent: "center" }}>
        {["Agents", "Tasks", "Code", "Done"].map((label, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 16px",
              borderRadius: 20,
              backgroundColor: currentPage === idx ? PURPLE : SURFACE,
              border: `1px solid ${currentPage >= idx ? PURPLE : BORDER}`,
              transition: "all 0.3s",
            }}
          >
            <span style={{ color: currentPage > idx ? GREEN : currentPage === idx ? TEXT : DIM, fontSize: 14 }}>
              {currentPage > idx ? "✓" : idx + 1}
            </span>
            <span style={{ color: currentPage >= idx ? TEXT : DIM, fontSize: 14 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Main content area - paginated */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Page 1: Agents spawning */}
        {currentPage === 0 && (
          <div
            style={{
              opacity: pageOpacity,
              transform: `translateX(${pageSlideX}px)`,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 20,
              padding: 20,
            }}
          >
            {IMPLEMENT_AGENTS.map((agent, idx) => {
              const agentDelay = idx * fps * 0.4;
              const agentFrame = pageFrame - agentDelay;
              const isVisible = agentFrame > 0;
              if (!isVisible) return <div key={idx} />;

              const scale = spring({ frame: agentFrame, fps, config: { damping: 12, stiffness: 150 } });
              const progress = Math.min(100, (agentFrame / (fps * 3)) * 100);

              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: SURFACE,
                    borderRadius: 16,
                    border: `2px solid ${agent.color}`,
                    padding: 24,
                    transform: `scale(${scale})`,
                    boxShadow: `0 0 20px ${agent.color}30`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 32 }}>{agent.icon}</span>
                    <span style={{ color: agent.color, fontWeight: 700, fontSize: 18 }}>{agent.name}</span>
                  </div>
                  <div style={{ color: TEXT, fontSize: 16, marginBottom: 16 }}>{agent.task}</div>
                  <div style={{ height: 10, backgroundColor: BORDER, borderRadius: 5 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${progress}%`,
                        backgroundColor: agent.color,
                        borderRadius: 5,
                        boxShadow: `0 0 10px ${agent.color}`,
                      }}
                    />
                  </div>
                  <div style={{ color: DIM, fontSize: 14, marginTop: 8 }}>
                    {SPINNER[spinnerIdx]} {Math.floor(progress)}%
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Page 2: Task panel with rapid completion */}
        {currentPage === 1 && (
          <div
            style={{
              opacity: pageOpacity,
              transform: `translateX(${pageSlideX}px)`,
              display: "flex",
              gap: 30,
              height: "100%",
            }}
          >
            <div
              style={{
                flex: 1,
                backgroundColor: SURFACE,
                borderRadius: 16,
                border: `2px solid ${CYAN}`,
                padding: 30,
              }}
            >
              <div style={{ color: CYAN, fontSize: 20, fontWeight: 700, marginBottom: 24, letterSpacing: 2 }}>
                📋 TASK PANEL
              </div>
              {IMPLEMENT_TASKS.map((task, idx) => {
                const taskDelay = idx * fps * 0.5;
                const taskFrame = pageFrame - taskDelay;
                const isVisible = taskFrame > 0;
                const isComplete = taskFrame > fps * 1.5;

                if (!isVisible) return null;

                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      marginBottom: 16,
                      padding: "12px 16px",
                      backgroundColor: isComplete ? `${GREEN}15` : "transparent",
                      borderRadius: 8,
                      border: `1px solid ${isComplete ? GREEN : BORDER}`,
                    }}
                  >
                    <span style={{ color: isComplete ? GREEN : YELLOW, fontSize: 24 }}>
                      {isComplete ? "✓" : SPINNER[spinnerIdx]}
                    </span>
                    <span style={{ color: TEXT, fontSize: 18, flex: 1 }}>#{task.id} {task.name}</span>
                    {isComplete && <span style={{ color: GREEN, fontSize: 14 }}>Done</span>}
                  </div>
                );
              })}
            </div>
            <div
              style={{
                flex: 1,
                backgroundColor: SURFACE,
                borderRadius: 16,
                border: `2px solid ${PURPLE}`,
                padding: 30,
              }}
            >
              <div style={{ color: PURPLE, fontSize: 20, fontWeight: 700, marginBottom: 24, letterSpacing: 2 }}>
                📁 FILES CREATED
              </div>
              {["src/api/auth.py", "src/models/user.py", "src/utils/jwt.py", "src/middleware/auth.py", "tests/test_auth.py"].map((file, idx) => {
                const fileDelay = idx * fps * 0.4;
                const fileFrame = pageFrame - fileDelay;
                const isVisible = fileFrame > 0;
                if (!isVisible) return null;

                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 12,
                      color: TEXT,
                      fontSize: 16,
                    }}
                  >
                    <span style={{ color: GREEN }}>+</span>
                    <span>{file}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Page 3: Code being written line by line */}
        {currentPage === 2 && (
          <div
            style={{
              opacity: pageOpacity,
              transform: `translateX(${pageSlideX}px)`,
              backgroundColor: SURFACE,
              borderRadius: 16,
              border: `2px solid ${GREEN}`,
              padding: 30,
              height: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <span style={{ color: GREEN, fontSize: 18 }}>●</span>
              <span style={{ color: DIM, fontSize: 16 }}>src/api/auth.py</span>
              <span style={{ color: YELLOW, fontSize: 14, marginLeft: "auto" }}>
                {SPINNER[spinnerIdx]} Writing...
              </span>
            </div>
            {[
              { code: '@router.post("/login")', color: PURPLE },
              { code: 'async def login(credentials: LoginSchema):', color: BLUE },
              { code: '    """Authenticate user and return JWT tokens."""', color: DIM },
              { code: '    user = await authenticate(credentials)', color: TEXT },
              { code: '    if not user:', color: TEXT },
              { code: '        raise HTTPException(401, "Invalid credentials")', color: RED },
              { code: '    access_token = create_access_token(user.id)', color: TEXT },
              { code: '    refresh_token = create_refresh_token(user.id)', color: TEXT },
              { code: '    return {"access_token": access_token, "refresh_token": refresh_token}', color: GREEN },
            ].map((line, idx) => {
              const lineDelay = idx * fps * 0.35;
              const lineFrame = pageFrame - lineDelay;
              const isVisible = lineFrame > 0;
              const typedChars = Math.min(Math.floor(lineFrame * 1.5), line.code.length);

              if (!isVisible) return null;

              return (
                <div key={idx} style={{ color: line.color, fontSize: 18, marginBottom: 8, fontFamily: "SF Mono, Monaco, monospace" }}>
                  {line.code.slice(0, typedChars)}
                  {typedChars < line.code.length && (
                    <span style={{ backgroundColor: TEXT, width: 2, height: 18, display: "inline-block" }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Page 4: Complete summary */}
        {currentPage === 3 && (
          <div
            style={{
              opacity: pageOpacity,
              transform: `translateX(${pageSlideX}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 30,
            }}
          >
            <div
              style={{
                fontSize: 80,
                color: GREEN,
                textShadow: `0 0 40px ${GREEN}60`,
              }}
            >
              ✓
            </div>
            <div style={{ color: GREEN, fontSize: 48, fontWeight: 700 }}>Feature Complete</div>
            <div style={{ display: "flex", gap: 40 }}>
              {[
                { value: "6", label: "Files", color: PURPLE },
                { value: "487", label: "Lines", color: CYAN },
                { value: "12", label: "Tests", color: GREEN },
                { value: "5", label: "Agents", color: YELLOW },
              ].map((stat, idx) => {
                const statDelay = idx * fps * 0.2;
                const statFrame = pageFrame - statDelay;
                const scale = spring({ frame: Math.max(0, statFrame), fps, config: { damping: 12, stiffness: 100 } });

                return (
                  <div
                    key={idx}
                    style={{
                      textAlign: "center",
                      transform: `scale(${scale})`,
                    }}
                  >
                    <div style={{ fontSize: 48, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 16, color: DIM }}>{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Scene 3: /verify (22-32s) - 10s compressed
const VerifyScene: React.FC<{ frame: number; fps: number; width: number }> = ({ frame, fps, width: _width }) => {
  const showCommand = frame >= 0;
  const showAgents = frame >= fps * 0.5;  // Was fps * 1
  const showGrade = frame >= fps * 5;      // Was fps * 10
  const showVerdict = frame >= fps * 7;    // Was fps * 12

  const commandTyped = Math.min(Math.floor(frame * 3), "/verify authentication".length); // Faster typing

  // Calculate overall grade
  const overallGrade = 8.7;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 40 }}>
      {/* Command */}
      <div
        style={{
          backgroundColor: SURFACE,
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          padding: 20,
          marginBottom: 30,
          fontFamily: "SF Mono, Monaco, Menlo, monospace",
        }}
      >
        {showCommand && (
          <div style={{ fontSize: 28, color: GREEN }}>
            <span style={{ color: GREEN }}>$ </span>
            {"/verify authentication".slice(0, commandTyped)}
          </div>
        )}
      </div>

      {/* Agent grid */}
      {showAgents && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, marginBottom: 30 }}>
          {VERIFY_AGENTS.map((agent, idx) => {
            const agentDelay = fps * 0.5 + idx * fps * 0.25; // Faster stagger
            const agentFrame = frame - agentDelay;
            const isVisible = agentFrame > 0;

            if (!isVisible) return null;

            const scale = spring({ frame: agentFrame, fps, config: { damping: 15, stiffness: 200 } });
            const progress = Math.min(100, Math.max(0, (agentFrame / (fps * 2)) * 100)); // 2x faster
            const isDone = progress >= 100;
            const showScore = agentFrame > fps * 2.5; // Faster reveal

            return (
              <div
                key={idx}
                style={{
                  backgroundColor: SURFACE,
                  borderRadius: 12,
                  border: `2px solid ${isDone ? GREEN : agent.color}`,
                  padding: 20,
                  transform: `scale(${scale})`,
                  textAlign: "center",
                  boxShadow: isDone ? `0 0 20px ${GREEN}30` : "none",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{agent.icon}</div>
                <div style={{ color: agent.color, fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{agent.name}</div>

                {!showScore ? (
                  <div style={{ height: 6, backgroundColor: BORDER, borderRadius: 3 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${progress}%`,
                        backgroundColor: agent.color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ color: GREEN, fontSize: 24, fontWeight: 700 }}>{agent.score}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Grade reveal */}
      {showGrade && (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: interpolate(frame - fps * 5, [0, fps * 0.3], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: DIM, fontSize: 24, marginBottom: 16, letterSpacing: 2 }}>QUALITY SCORE</div>
            <div
              style={{
                fontSize: 160,
                fontWeight: 700,
                color: GREEN,
                fontFamily: "SF Mono, Monaco, Menlo, monospace",
                textShadow: `0 0 60px ${GREEN}60`,
                lineHeight: 1,
              }}
            >
              {overallGrade}
            </div>
            <div style={{ color: DIM, fontSize: 24, marginTop: 8 }}>/ 10</div>
          </div>
        </div>
      )}

      {/* Verdict */}
      {showVerdict && (
        <div
          style={{
            backgroundColor: `${GREEN}15`,
            borderRadius: 16,
            border: `3px solid ${GREEN}`,
            padding: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            opacity: interpolate(frame - fps * 7, [0, fps * 0.3], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <span style={{ fontSize: 40 }}>🚀</span>
          <span style={{ color: GREEN, fontSize: 36, fontWeight: 700, letterSpacing: 1 }}>READY FOR MERGE</span>
        </div>
      )}
    </div>
  );
};

// Scene 4: Breadth montage (32-42s) - 10s compressed, 2s per command
const BreadthScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const commandDuration = fps * 2; // 2 seconds per command (was 3)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: 60,
      }}
    >
      <div style={{ color: DIM, fontSize: 24, marginBottom: 40, letterSpacing: 2 }}>AND MUCH MORE...</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 1200 }}>
        {BREADTH_COMMANDS.map((item, idx) => {
          const itemStart = idx * commandDuration;
          const itemFrame = frame - itemStart;
          const isVisible = itemFrame > 0;
          const showResult = itemFrame > fps * 0.5; // Faster result (was fps * 1)

          if (!isVisible) return null;

          const opacity = interpolate(itemFrame, [0, fps * 0.2], [0, 1], { extrapolateRight: "clamp" });
          const slideX = interpolate(itemFrame, [0, fps * 0.2], [-50, 0], { extrapolateRight: "clamp" });

          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 30,
                opacity,
                transform: `translateX(${slideX}px)`,
                backgroundColor: SURFACE,
                borderRadius: 16,
                border: `2px solid ${item.color}`,
                padding: "24px 40px",
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: item.color,
                  fontFamily: "SF Mono, Monaco, Menlo, monospace",
                  minWidth: 280,
                }}
              >
                {item.cmd}
              </div>
              {showResult && (
                <div
                  style={{
                    fontSize: 24,
                    color: TEXT,
                    opacity: interpolate(itemFrame - fps * 0.5, [0, fps * 0.2], [0, 1], { extrapolateRight: "clamp" }),
                  }}
                >
                  → {item.result}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Scene 5: CTA (42-50s) - 8s with more impact
const CTAScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [fps * 1, fps * 1.5], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = spring({ frame: Math.max(0, frame - fps * 1), fps, config: { damping: 12, stiffness: 100 } });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          textAlign: "center",
          marginBottom: 50,
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 700, color: TEXT, marginBottom: 16 }}>
          Works with your existing projects.
        </div>
        <div style={{ fontSize: 28, color: DIM }}>
          30+ plugins • {ORCHESTKIT_STATS.skills} skills • {ORCHESTKIT_STATS.agents} agents • {ORCHESTKIT_STATS.hooks} hooks
        </div>
      </div>

      {/* CTA Button */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          backgroundColor: `${PURPLE}20`,
          borderRadius: 16,
          border: `3px solid ${PURPLE}`,
          padding: "24px 48px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: `0 0 40px ${PURPLE}40`,
        }}
      >
        <span style={{ color: GREEN, fontSize: 32, fontFamily: "SF Mono, Monaco, Menlo, monospace" }}>$</span>
        <span
          style={{
            color: TEXT,
            fontSize: 32,
            fontWeight: 700,
            fontFamily: "SF Mono, Monaco, Menlo, monospace",
          }}
        >
          /plugin install ork
        </span>
      </div>

      {/* OrchestKit logo/name */}
      <div
        style={{
          marginTop: 50,
          opacity: interpolate(frame, [fps * 2, fps * 2.5], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            background: `linear-gradient(90deg, ${PURPLE} 0%, ${CYAN} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: 4,
          }}
        >
          ORCHESTKIT
        </div>
      </div>
    </div>
  );
};
