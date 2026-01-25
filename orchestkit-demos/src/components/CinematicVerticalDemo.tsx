import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
  OffthreadVideo,
} from "remotion";
import { z } from "zod";
import { SceneTransition } from "./shared/TransitionWipe";

export const cinematicVerticalDemoSchema = z.object({
  skillName: z.string(),
  hook: z.string(),
  problemPoints: z.array(z.string()).default([
    "Manual processes slow you down",
    "Context switching kills productivity",
  ]),
  terminalVideo: z.string(),
  manimVideo: z.string().optional(),
  results: z.object({
    before: z.string(),
    after: z.string(),
  }),
  primaryColor: z.string().default("#8b5cf6"),
  ccVersion: z.string().default("CC 2.1.16"),
  // Scene durations (shorter for vertical/social)
  hookDuration: z.number().default(45),
  problemDuration: z.number().default(60),
  manimDuration: z.number().default(90),
  terminalDuration: z.number().default(180),
  resultsDuration: z.number().default(60),
  ctaDuration: z.number().default(45),
  // Audio
  backgroundMusic: z.string().optional(),
  musicVolume: z.number().default(0.12),
});

type CinematicVerticalDemoProps = z.infer<typeof cinematicVerticalDemoSchema>;

export const CinematicVerticalDemo: React.FC<CinematicVerticalDemoProps> = ({
  skillName,
  hook,
  problemPoints,
  terminalVideo,
  results,
  primaryColor,
  ccVersion,
  hookDuration,
  problemDuration,
  // manimDuration is defined in schema but not used in vertical layout (no manim scene)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  manimDuration: _manimDuration,
  terminalDuration,
  resultsDuration,
  ctaDuration,
  backgroundMusic,
  musicVolume,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // Calculate scene start frames
  const hookStart = 0;
  const problemStart = hookDuration;
  const terminalStart = problemStart + problemDuration;
  const resultsStart = terminalStart + terminalDuration;
  const ctaStart = resultsStart + resultsDuration;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Background Music */}
      {backgroundMusic && (
        <Audio
          src={staticFile(backgroundMusic)}
          volume={(f) => {
            const fadeIn = Math.min(1, f / (fps * 0.5));
            const fadeOut = Math.min(1, (durationInFrames - f) / (fps * 1));
            return fadeIn * fadeOut * musicVolume;
          }}
        />
      )}

      {/* Scene 1: Hook (Vertical optimized) */}
      <Sequence from={hookStart} durationInFrames={hookDuration}>
        <VerticalHookScene
          skillName={skillName}
          hook={hook}
          ccVersion={ccVersion}
          primaryColor={primaryColor}
        />
      </Sequence>

      <SceneTransition
        type="fade"
        startFrame={hookStart + hookDuration - 8}
        durationFrames={8}
      />

      {/* Scene 2: Problem (2 points max for vertical) */}
      <Sequence from={problemStart} durationInFrames={problemDuration}>
        <VerticalProblemScene problems={problemPoints.slice(0, 2)} />
      </Sequence>

      <SceneTransition
        type="fade"
        startFrame={problemStart + problemDuration - 8}
        durationFrames={8}
      />

      {/* Scene 3: Terminal (full screen vertical) */}
      <Sequence from={terminalStart} durationInFrames={terminalDuration}>
        <VerticalTerminalScene
          videoPath={terminalVideo}
          skillName={skillName}
          primaryColor={primaryColor}
        />
      </Sequence>

      <SceneTransition
        type="fade"
        startFrame={terminalStart + terminalDuration - 8}
        durationFrames={8}
      />

      {/* Scene 4: Results (stacked vertical) */}
      <Sequence from={resultsStart} durationInFrames={resultsDuration}>
        <VerticalResultsScene
          before={results.before}
          after={results.after}
          primaryColor={primaryColor}
        />
      </Sequence>

      <SceneTransition
        type="fade"
        startFrame={resultsStart + resultsDuration - 8}
        durationFrames={8}
      />

      {/* Scene 5: CTA */}
      <Sequence from={ctaStart} durationInFrames={ctaDuration}>
        <VerticalCTAScene primaryColor={primaryColor} />
      </Sequence>

      {/* Watermark */}
      <VerticalWatermark />

      {/* Progress bar */}
      <VerticalProgressBar
        progress={frame / durationInFrames}
        primaryColor={primaryColor}
      />
    </AbsoluteFill>
  );
};

// Vertical-optimized scene components
const VerticalHookScene: React.FC<{
  skillName: string;
  hook: string;
  ccVersion: string;
  primaryColor: string;
}> = ({ skillName, hook, ccVersion, primaryColor }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 40px",
      }}
    >
      {/* Background glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${primaryColor}15 0%, transparent 70%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          textAlign: "center",
        }}
      >
        {/* Badge */}
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            fontFamily: "Menlo, monospace",
            letterSpacing: "0.15em",
            opacity: Math.min(1, frame / 10),
          }}
        >
          {ccVersion}
        </div>

        {/* Skill name */}
        <code
          style={{
            fontSize: 48,
            color: primaryColor,
            fontFamily: "Menlo, monospace",
            fontWeight: 700,
            opacity: Math.min(1, (frame - 5) / 10),
          }}
        >
          /{skillName}
        </code>

        {/* Hook */}
        <h1
          style={{
            fontSize: 36,
            color: "white",
            fontFamily: "Inter, system-ui",
            fontWeight: 700,
            lineHeight: 1.3,
            margin: 0,
            opacity: Math.min(1, (frame - 10) / 10),
          }}
        >
          {hook}
        </h1>
      </div>
    </AbsoluteFill>
  );
};

const VerticalProblemScene: React.FC<{ problems: string[] }> = ({
  problems,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 40px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            color: "#6b7280",
            fontFamily: "Inter, system-ui",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            textAlign: "center",
            opacity: Math.min(1, frame / 10),
          }}
        >
          Without OrchestKit
        </h2>

        {problems.map((problem, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: Math.min(1, (frame - 15 - i * 10) / 10),
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: "#ef444420",
                border: "2px solid #ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                color: "#ef4444",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              ✗
            </div>
            <span
              style={{
                fontSize: 22,
                color: "#e5e7eb",
                fontFamily: "Inter, system-ui",
              }}
            >
              {problem}
            </span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const VerticalTerminalScene: React.FC<{
  videoPath: string;
  skillName: string;
  primaryColor: string;
}> = ({ videoPath, skillName, primaryColor }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 10,
          opacity: Math.min(1, frame / 15),
        }}
      >
        <span
          style={{
            fontSize: 14,
            color: primaryColor,
            fontFamily: "Menlo, monospace",
            padding: "8px 16px",
            backgroundColor: "rgba(10,10,15,0.8)",
            borderRadius: 8,
            border: `1px solid ${primaryColor}40`,
          }}
        >
          /{skillName} in action
        </span>
      </div>

      {/* Terminal video - centered */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 80,
          paddingBottom: 80,
        }}
      >
        <OffthreadVideo
          src={staticFile(videoPath)}
          style={{
            width: "95%",
            maxHeight: "85%",
            objectFit: "contain",
            borderRadius: 12,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const VerticalResultsScene: React.FC<{
  before: string;
  after: string;
  primaryColor: string;
}> = ({ before, after }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 40px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 40,
          width: "100%",
        }}
      >
        {/* Before */}
        <div
          style={{
            padding: "24px",
            backgroundColor: "#ef444410",
            borderRadius: 16,
            border: "2px solid #ef444440",
            textAlign: "center",
            opacity: Math.min(1, frame / 10),
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "#6b7280",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Before
          </div>
          <div
            style={{
              fontSize: 24,
              color: "white",
              fontFamily: "Inter, system-ui",
            }}
          >
            {before}
          </div>
        </div>

        {/* Arrow */}
        <div
          style={{
            textAlign: "center",
            fontSize: 32,
            color: "#22c55e",
            opacity: Math.min(1, (frame - 15) / 10),
          }}
        >
          ↓
        </div>

        {/* After */}
        <div
          style={{
            padding: "24px",
            backgroundColor: "#22c55e10",
            borderRadius: 16,
            border: "2px solid #22c55e40",
            textAlign: "center",
            opacity: Math.min(1, (frame - 20) / 10),
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "#6b7280",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            After
          </div>
          <div
            style={{
              fontSize: 24,
              color: "white",
              fontFamily: "Inter, system-ui",
              fontWeight: 600,
            }}
          >
            {after}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const VerticalCTAScene: React.FC<{ primaryColor: string }> = ({
  primaryColor,
}) => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame * 0.15) * 0.02;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          transform: `scale(${pulse})`,
          opacity: Math.min(1, frame / 10),
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, #6366f1 0%, ${primaryColor} 100%)`,
            borderRadius: 16,
            padding: "18px 32px",
            boxShadow: `0 15px 50px ${primaryColor}60`,
          }}
        >
          <code
            style={{
              fontSize: 28,
              color: "white",
              fontFamily: "Menlo, monospace",
              fontWeight: 600,
            }}
          >
            /plugin install ork
          </code>
        </div>

        <span
          style={{
            fontSize: 14,
            color: "#9ca3af",
            fontFamily: "Menlo, monospace",
          }}
        >
          170 skills * 35 agents
        </span>
      </div>
    </AbsoluteFill>
  );
};

const VerticalWatermark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 20,
      right: 20,
      opacity: 0.5,
      fontSize: 12,
      color: "#6b7280",
      fontFamily: "Menlo, monospace",
    }}
  >
    OrchestKit
  </div>
);

const VerticalProgressBar: React.FC<{
  progress: number;
  primaryColor: string;
}> = ({ progress, primaryColor }) => (
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
        width: `${progress * 100}%`,
        background: `linear-gradient(90deg, ${primaryColor}, #6366f1)`,
      }}
    />
  </div>
);
