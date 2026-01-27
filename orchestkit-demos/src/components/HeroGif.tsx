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
 * HeroGif v4 - Redesigned with larger text, vibrant colors, stunning finale
 *
 * 30 seconds @ 15fps = 450 frames
 * Resolution: 1200x700
 */

export const heroGifSchema = z.object({
  primaryColor: z.string().default("#8b5cf6"),
  secondaryColor: z.string().default("#22c55e"),
});

type HeroGifProps = z.infer<typeof heroGifSchema>;

// Vibrant Colors
const BG = "#030712";
const TERMINAL_BG = "#0f172a";
const TERMINAL_HEADER = "#1e293b";
const BORDER = "#334155";
const TEXT = "#f8fafc";
const DIM = "#94a3b8";
const GREEN = "#22c55e";
const PURPLE = "#a855f7";
const CYAN = "#06b6d4";
const ORANGE = "#f97316";
const YELLOW = "#eab308";
const PINK = "#ec4899";
const RED = "#ef4444";
const BLUE = "#3b82f6";

// Scene definitions - shorter and punchier
const SCENES = [
  {
    command: "/explore",
    duration: 3.5,
    color: PURPLE,
    bgGradient: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
    phases: [
      { title: "🔍 EXPLORE AGENT", lines: [
        { text: "Spawning with claude-sonnet-4...", color: CYAN },
      ]},
      { title: "SCANNING", lines: [
        { text: "src/components/  → 127 files", color: TEXT },
        { text: "src/api/        → 43 files", color: TEXT },
        { text: "src/hooks/      → 31 files", color: TEXT },
        { text: "Total: 847 files ✓", color: GREEN, isBold: true },
      ]},
      { title: "PATTERNS", lines: [
        { text: "React 19 • TypeScript • FastAPI • Zustand", color: ORANGE, isBadge: true },
      ]},
      { title: "", lines: [
        { text: "✓ Architecture mapped in 3.2s", color: GREEN, isBold: true, isResult: true },
      ]},
    ],
  },
  {
    command: "/brainstorming",
    duration: 3.5,
    color: YELLOW,
    bgGradient: "linear-gradient(135deg, #422006 0%, #0f172a 100%)",
    phases: [
      { title: "💡 IDEA GENERATION", lines: [
        { text: "Topic: \"Add user authentication\"", color: YELLOW },
      ]},
      { title: "AGENTS SPAWNED", lines: [
        { text: "🏗️  backend-architect", color: CYAN },
        { text: "🔒 security-auditor", color: GREEN },
        { text: "📊 workflow-architect", color: PURPLE },
      ]},
      { title: "TOP RECOMMENDATION", lines: [
        { text: "→ JWT + refresh token rotation", color: GREEN, isBold: true, isResult: true },
      ]},
    ],
  },
  {
    command: "/implement",
    duration: 4,
    color: CYAN,
    bgGradient: "linear-gradient(135deg, #0c4a6e 0%, #0f172a 100%)",
    phases: [
      { title: "🛠️ TASK SYSTEM", lines: [
        { text: "Creating implementation plan...", color: CYAN },
      ]},
      { title: "TASKS", lines: [
        { text: "#1 ✓ Create auth endpoints", color: GREEN },
        { text: "#2 ✓ Add User model", color: GREEN },
        { text: "#3 ✓ JWT utilities", color: GREEN },
        { text: "#4 ✓ Auth middleware", color: GREEN },
        { text: "#5 ✓ Integration tests", color: GREEN },
      ]},
      { title: "SKILLS USED", lines: [
        { text: "fastapi-advanced • sqlalchemy-2-async • pytest-advanced", color: ORANGE, isBadge: true },
      ]},
      { title: "", lines: [
        { text: "✓ 6 files • 487 lines • 12 tests", color: GREEN, isBold: true, isResult: true },
      ]},
    ],
  },
  {
    command: "/verify",
    duration: 3.5,
    color: GREEN,
    bgGradient: "linear-gradient(135deg, #14532d 0%, #0f172a 100%)",
    phases: [
      { title: "🧪 PARALLEL VERIFICATION", lines: [
        { text: "Launching 6 specialized agents...", color: GREEN },
      ]},
      { title: "Agent Grid", isAgentGrid: true, agents: [
        { icon: "🔒", name: "Security", color: RED },
        { icon: "🧪", name: "Tests", color: CYAN },
        { icon: "📊", name: "Quality", color: PURPLE },
        { icon: "⚡", name: "Perf", color: YELLOW },
        { icon: "♿", name: "A11y", color: BLUE },
        { icon: "📝", name: "Docs", color: PINK },
      ]},
      { title: "", lines: [
        { text: "✓ 6/6 agents approved • Score: 9.4/10", color: GREEN, isBold: true, isResult: true },
      ]},
    ],
  },
  {
    command: "/review-pr",
    duration: 3,
    color: ORANGE,
    bgGradient: "linear-gradient(135deg, #7c2d12 0%, #0f172a 100%)",
    phases: [
      { title: "📝 PR #142 REVIEW", lines: [
        { text: "6 files changed (+487 -12)", color: ORANGE },
      ]},
      { title: "CHECKS", lines: [
        { text: "🏗️  Architecture: Clean ✓", color: GREEN },
        { text: "🔒 Security: Secure ✓", color: GREEN },
        { text: "⚡ Performance: Fast ✓", color: GREEN },
        { text: "🧪 Tests: 94% coverage ✓", color: GREEN },
      ]},
      { title: "", lines: [
        { text: "✓ Ready to merge 🚀", color: GREEN, isBold: true, isResult: true },
      ]},
    ],
  },
  {
    command: "/commit",
    duration: 2.5,
    color: PINK,
    bgGradient: "linear-gradient(135deg, #701a75 0%, #0f172a 100%)",
    phases: [
      { title: "📦 SMART COMMIT", lines: [
        { text: "Analyzing changes...", color: PINK },
      ]},
      { title: "GENERATED", lines: [
        { text: "feat(auth): add JWT authentication", color: TEXT, isBold: true },
        { text: "• Conventional format ✓", color: DIM },
        { text: "• No secrets detected ✓", color: DIM },
      ]},
      { title: "", lines: [
        { text: "✓ Committed: abc123f", color: GREEN, isBold: true, isResult: true },
      ]},
    ],
  },
  {
    command: "/create-pr",
    duration: 2.5,
    color: BLUE,
    bgGradient: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)",
    phases: [
      { title: "🚀 PR CREATION", lines: [
        { text: "Branch: feat/auth-jwt → main", color: BLUE },
      ]},
      { title: "AUTO-GENERATED", lines: [
        { text: "Summary, test plan, labels", color: DIM },
      ]},
      { title: "", lines: [
        { text: "✓ PR #143 created", color: GREEN, isBold: true, isResult: true },
      ]},
    ],
  },
  {
    command: "/remember",
    duration: 2.5,
    color: PINK,
    bgGradient: "linear-gradient(135deg, #4a044e 0%, #0f172a 100%)",
    phases: [
      { title: "💾 KNOWLEDGE CAPTURE", lines: [
        { text: "Extracting patterns...", color: PINK },
      ]},
      { title: "STORED", lines: [
        { text: "Pattern: jwt-auth-fastapi", color: TEXT },
        { text: "Tags: auth • jwt • security", color: ORANGE, isBadge: true },
      ]},
      { title: "", lines: [
        { text: "✓ Saved to knowledge graph", color: GREEN, isBold: true, isResult: true },
      ]},
    ],
  },
  {
    command: "/doctor",
    duration: 2,
    color: GREEN,
    bgGradient: "linear-gradient(135deg, #052e16 0%, #0f172a 100%)",
    phases: [
      { title: "🏥 HEALTH CHECK", lines: [
        { text: `✓ ${ORCHESTKIT_STATS.skills} skills loaded`, color: GREEN },
        { text: `✓ ${ORCHESTKIT_STATS.agents} agents ready`, color: GREEN },
        { text: `✓ ${ORCHESTKIT_STATS.hooks} hooks active`, color: GREEN },
      ]},
      { title: "", lines: [
        { text: "✓ All systems operational", color: GREEN, isBold: true, isResult: true },
      ]},
    ],
  },
];

// Calculate total duration
const TOTAL_DURATION = SCENES.reduce((acc, s) => acc + s.duration, 0) + 3; // +3 for finale

export const HeroGif: React.FC<HeroGifProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find current scene
  let accumulatedFrames = 0;
  let currentSceneIndex = 0;
  let sceneFrame = 0;

  for (let i = 0; i < SCENES.length; i++) {
    const sceneDurationFrames = SCENES[i].duration * fps;
    if (frame < accumulatedFrames + sceneDurationFrames) {
      currentSceneIndex = i;
      sceneFrame = frame - accumulatedFrames;
      break;
    }
    accumulatedFrames += sceneDurationFrames;
    if (i === SCENES.length - 1) {
      currentSceneIndex = -1; // Finale
      sceneFrame = frame - accumulatedFrames;
    }
  }

  const isFinale = currentSceneIndex === -1;
  const currentScene = isFinale ? null : SCENES[currentSceneIndex];

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Main container */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 24,
          right: 24,
          bottom: 20,
          backgroundColor: TERMINAL_BG,
          borderRadius: 16,
          border: `2px solid ${BORDER}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 44,
            backgroundColor: TERMINAL_HEADER,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 8,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: RED }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: YELLOW }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: GREEN }} />
          <span style={{ marginLeft: 12, color: DIM, fontSize: 16, fontFamily: "SF Mono, Monaco, Menlo, monospace", fontWeight: 500 }}>
            ~/project — orchestkit
          </span>
          {/* Scene indicator */}
          {!isFinale && currentScene && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {SCENES.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: idx === currentSceneIndex ? currentScene.color : BORDER,
                    transition: "background-color 0.2s",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", background: currentScene?.bgGradient || "transparent" }}>
          {isFinale ? (
            <FinaleScene frame={sceneFrame} fps={fps} />
          ) : currentScene ? (
            <>
              {/* Left panel - Command */}
              <div
                style={{
                  width: 280,
                  borderRight: `2px solid ${BORDER}`,
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  fontFamily: "SF Mono, Monaco, Menlo, monospace",
                  background: "rgba(0,0,0,0.3)",
                }}
              >
                <CommandPanel
                  command={currentScene.command}
                  color={currentScene.color}
                  frame={sceneFrame}
                  fps={fps}
                />
              </div>

              {/* Right panel - Output */}
              <div
                style={{
                  flex: 1,
                  padding: 24,
                  overflow: "hidden",
                  fontFamily: "SF Mono, Monaco, Menlo, monospace",
                }}
              >
                <OutputPanel
                  phases={currentScene.phases}
                  frame={sceneFrame}
                  fps={fps}
                  sceneDuration={currentScene.duration}
                  accentColor={currentScene.color}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, backgroundColor: "#1e293b" }}>
          <div
            style={{
              height: "100%",
              width: `${(frame / (TOTAL_DURATION * fps)) * 100}%`,
              background: `linear-gradient(90deg, ${PURPLE} 0%, ${CYAN} 50%, ${GREEN} 100%)`,
              boxShadow: `0 0 10px ${CYAN}`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Left panel with command
const CommandPanel: React.FC<{
  command: string;
  color: string;
  frame: number;
  fps: number;
}> = ({ command, color, frame, fps }) => {
  const fullCmd = command;
  const charsTyped = Math.min(Math.floor(frame * 2), fullCmd.length);
  const displayCmd = fullCmd.slice(0, charsTyped);
  const cursorVisible = frame % 10 < 5 && charsTyped < fullCmd.length;
  const typingDone = charsTyped >= fullCmd.length;

  const glow = spring({
    frame: typingDone ? frame - fullCmd.length / 2 : 0,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  return (
    <div>
      <div style={{ color: DIM, fontSize: 14, marginBottom: 12, letterSpacing: 2, fontWeight: 600 }}>
        YOU TYPE
      </div>
      <div style={{ position: "relative" }}>
        <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color,
            textShadow: typingDone ? `0 0 ${20 * glow}px ${color}` : "none",
            transition: "text-shadow 0.3s",
          }}
        >
          <span style={{ color: GREEN }}>$ </span>
          {displayCmd}
          {cursorVisible && (
            <span
              style={{
                backgroundColor: TEXT,
                width: 3,
                height: 32,
                display: "inline-block",
                marginLeft: 2,
                verticalAlign: "middle",
              }}
            />
          )}
        </div>
      </div>
      {/* Command counter */}
      <div style={{ marginTop: 24, color: DIM, fontSize: 13 }}>
        <span style={{ color: GREEN }}>●</span> {SCENES.findIndex(s => s.command === command) + 1} of {SCENES.length} commands
      </div>
    </div>
  );
};

// Right panel with output
const OutputPanel: React.FC<{
  phases: any[];
  frame: number;
  fps: number;
  sceneDuration: number;
  accentColor: string;
}> = ({ phases, frame, fps, sceneDuration, accentColor }) => {
  const totalFrames = sceneDuration * fps;
  const framesPerPhase = totalFrames / phases.length;

  // Calculate scroll
  const scrollProgress = frame / totalFrames;
  const maxScroll = Math.max(0, phases.length * 100 - 400);
  const scrollY = scrollProgress * maxScroll;

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      <div style={{ color: accentColor, fontSize: 13, marginBottom: 16, letterSpacing: 2, fontWeight: 600 }}>
        ORCHESTKIT OUTPUT
      </div>
      <div
        style={{
          transform: `translateY(-${scrollY}px)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        {phases.map((phase, phaseIdx) => {
          const phaseStartFrame = phaseIdx * framesPerPhase;
          const phaseFrame = frame - phaseStartFrame;
          const isVisible = frame >= phaseStartFrame - 5;

          if (!isVisible) return null;

          const opacity = interpolate(phaseFrame, [-5, 8], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div key={phaseIdx} style={{ marginBottom: 20, opacity }}>
              {phase.title && (
                <div style={{ color: accentColor, fontSize: 15, marginBottom: 10, fontWeight: "bold", letterSpacing: 1 }}>
                  {phase.title}
                </div>
              )}

              {phase.isAgentGrid ? (
                <AgentGrid agents={phase.agents} frame={phaseFrame} fps={fps} />
              ) : (
                phase.lines?.map((line: any, lineIdx: number) => {
                  const lineDelay = lineIdx * 4;
                  const lineFrame = phaseFrame - lineDelay;
                  const lineOpacity = interpolate(lineFrame, [0, 6], [0, 1], { extrapolateRight: "clamp" });

                  if (lineFrame < -3) return null;

                  return (
                    <div
                      key={lineIdx}
                      style={{
                        color: line.color,
                        opacity: lineOpacity,
                        fontWeight: line.isBold ? "bold" : "normal",
                        fontSize: line.isResult ? 20 : line.isBadge ? 15 : 17,
                        marginBottom: line.isResult ? 0 : 6,
                        padding: line.isResult ? "12px 0" : 0,
                        borderTop: line.isResult ? `1px solid ${BORDER}` : "none",
                        marginTop: line.isResult ? 12 : 0,
                        textShadow: line.isResult ? `0 0 10px ${line.color}` : "none",
                      }}
                    >
                      {line.text}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Agent grid for /verify
const AgentGrid: React.FC<{
  agents: any[];
  frame: number;
  fps: number;
}> = ({ agents, frame, fps }) => {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {agents.map((agent, idx) => {
        const delay = idx * 5;
        const localFrame = frame - delay;
        const progress = Math.min(100, Math.max(0, localFrame * 10));
        const isDone = progress >= 100;

        const scale = spring({
          frame: Math.max(0, localFrame),
          fps,
          config: { damping: 15, stiffness: 200 },
        });

        return (
          <div
            key={idx}
            style={{
              padding: "12px 16px",
              backgroundColor: "rgba(30, 41, 59, 0.8)",
              borderRadius: 10,
              border: `2px solid ${isDone ? GREEN : BORDER}`,
              transform: `scale(${scale})`,
              opacity: localFrame > -2 ? 1 : 0,
              boxShadow: isDone ? `0 0 15px ${GREEN}40` : "none",
            }}
          >
            <div style={{ fontSize: 16, marginBottom: 8, fontWeight: "bold", color: agent.color }}>
              {agent.icon} {agent.name}
            </div>
            <div style={{ height: 6, backgroundColor: BORDER, borderRadius: 3 }}>
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  backgroundColor: isDone ? GREEN : agent.color,
                  borderRadius: 3,
                  transition: "width 0.1s",
                }}
              />
            </div>
            {isDone && (
              <div style={{ color: GREEN, fontSize: 14, marginTop: 6, textAlign: "center", fontWeight: "bold" }}>
                ✓ PASS
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Stunning finale scene
const FinaleScene: React.FC<{
  frame: number;
  fps: number;
}> = ({ frame, fps }) => {
  const stats = [
    { value: ORCHESTKIT_STATS.skills, label: "SKILLS", color: PURPLE, icon: "⚡" },
    { value: ORCHESTKIT_STATS.agents, label: "AGENTS", color: CYAN, icon: "🤖" },
    { value: ORCHESTKIT_STATS.hooks, label: "HOOKS", color: GREEN, icon: "🔗" },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        fontFamily: "SF Mono, Monaco, Menlo, monospace",
        background: "radial-gradient(ellipse at center, #1e1b4b 0%, #030712 70%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated background rings */}
      {[0, 1, 2].map((ring) => {
        const ringScale = spring({
          frame: Math.max(0, frame - ring * 8),
          fps,
          config: { damping: 30, stiffness: 50 },
        });
        const ringOpacity = interpolate(frame - ring * 8, [0, 20, 40], [0, 0.15, 0], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={ring}
            style={{
              position: "absolute",
              width: 600 + ring * 200,
              height: 600 + ring * 200,
              borderRadius: "50%",
              border: `2px solid ${PURPLE}`,
              opacity: ringOpacity,
              transform: `scale(${ringScale})`,
            }}
          />
        );
      })}

      {/* Stats */}
      <div style={{ display: "flex", gap: 60, marginBottom: 40, zIndex: 1 }}>
        {stats.map((stat, idx) => {
          const delay = idx * 6;
          const localFrame = Math.max(0, frame - delay);

          const scale = spring({
            frame: localFrame,
            fps,
            config: { damping: 12, stiffness: 100 },
          });

          const countUp = Math.min(
            Math.floor(interpolate(localFrame, [0, 20], [0, stat.value], {
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            })),
            stat.value
          );

          return (
            <div
              key={idx}
              style={{
                textAlign: "center",
                transform: `scale(${scale})`,
                opacity: localFrame > 0 ? 1 : 0,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{stat.icon}</div>
              <div
                style={{
                  fontSize: 72,
                  fontWeight: "bold",
                  color: stat.color,
                  textShadow: `0 0 30px ${stat.color}, 0 0 60px ${stat.color}40`,
                  lineHeight: 1,
                }}
              >
                {countUp}
              </div>
              <div style={{ fontSize: 18, color: DIM, marginTop: 8, letterSpacing: 3, fontWeight: 600 }}>
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tagline */}
      {frame >= 25 && (
        <div
          style={{
            color: TEXT,
            fontSize: 28,
            fontWeight: "bold",
            opacity: interpolate(frame - 25, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
            marginBottom: 20,
            zIndex: 1,
            letterSpacing: 1,
          }}
        >
          Your AI-Powered Development Toolkit
        </div>
      )}

      {/* CTA */}
      {frame >= 32 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "16px 32px",
            backgroundColor: "rgba(139, 92, 246, 0.2)",
            borderRadius: 12,
            border: `2px solid ${PURPLE}`,
            opacity: interpolate(frame - 32, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
            boxShadow: `0 0 30px ${PURPLE}40`,
            zIndex: 1,
          }}
        >
          <span style={{ color: GREEN, fontSize: 22 }}>$</span>
          <span style={{ color: TEXT, fontSize: 22, fontWeight: "bold" }}>/plugin install ork</span>
        </div>
      )}
    </div>
  );
};
