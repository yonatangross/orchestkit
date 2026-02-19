/**
 * TerminalFlow - Single full-screen terminal composition
 *
 * Simulates the actual user experience of running an OrchestKit skill:
 * Hook → Command → Agent Spawn → Parallel Agent Race → Results → CTA
 *
 * Unlike TriTerminalRace (3 side-by-side panels), this shows ONE terminal
 * session at full resolution, making it feel like a real CLI recording.
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
  staticFile,
} from "remotion";
import type { TerminalFlowProps } from "./schema";
import { BG, FG, GREEN, MONO, SANS } from "./constants";
import { TerminalChrome } from "./TerminalChrome";
import { TypewriterLine } from "./TypewriterLine";
import { AgentSpinner } from "./AgentSpinner";
import { ResultsBlock } from "./ResultsBlock";
import { CTAOverlay } from "./CTAOverlay";

// Timeline constants (frames @ 30fps)
const HOOK_START = 0;
const HOOK_END = 60;
const CMD_START = 60;
const SPAWN_START = 120;
const RACE_START = 165;
const RESULTS_START = 420;
const CTA_START = 510;

export const TerminalFlow: React.FC<TerminalFlowProps> = ({
  skillName,
  skillCommand,
  hook,
  primaryColor,
  prompt,
  scopeQuestion,
  scopeAnswer,
  agents,
  resultTitle,
  score,
  findings,
  advisories,
  ctaCommand,
  ctaSubtext,
  backgroundMusic,
  musicVolume,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Terminal window entrance
  const terminalOpacity = interpolate(
    frame, [CMD_START, CMD_START + 15], [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );
  const terminalScale = spring({
    frame: Math.max(0, frame - CMD_START),
    fps,
    config: { damping: 30, stiffness: 120 },
  });

  // Command typing starts after terminal appears
  const cmdTypeStart = CMD_START + 12;
  const scopeStart = cmdTypeStart + Math.ceil(skillCommand.length / 0.8) + 10;
  const answerStart = scopeStart + 15;
  const taskCreateStart = SPAWN_START;
  const spawnHeaderStart = SPAWN_START + 12;

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: SANS }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}12 0%, transparent 60%)`,
        }}
      />

      {backgroundMusic && (
        <Audio src={staticFile(backgroundMusic)} volume={musicVolume} />
      )}

      {/* Hook scene (0-2s) */}
      <Sequence from={HOOK_START} durationInFrames={HOOK_END - HOOK_START}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: 52,
              fontWeight: 700,
              color: FG,
              textAlign: "center",
              opacity: interpolate(frame, [0, 15], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {hook}
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 26,
              color: primaryColor,
              opacity: interpolate(frame, [15, 30], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            /ork:{skillName}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Terminal scenes (2s-20s) */}
      <Sequence from={CMD_START} durationInFrames={600 - CMD_START}>
        <AbsoluteFill
          style={{
            padding: 40,
            display: "flex",
            alignItems: "stretch",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              flex: 1,
              maxWidth: 1840,
              display: "flex",
              flexDirection: "column",
              backgroundColor: BG,
              borderRadius: 16,
              border: "1px solid #30363d",
              overflow: "hidden",
              opacity: terminalOpacity,
              transform: `scale(${Math.min(1, terminalScale)})`,
              boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
            }}
          >
            <TerminalChrome title={`claude — ${prompt}`} opacity={1} />

            <div
              style={{
                flex: 1,
                padding: "20px 28px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <TypewriterLine
                text={skillCommand}
                startFrame={cmdTypeStart}
                charsPerFrame={0.8}
                color={primaryColor}
                prefix={<span style={{ color: GREEN }}>❯ </span>}
              />

              {scopeQuestion && frame >= scopeStart && (
                <div
                  style={{
                    fontFamily: MONO, fontSize: 18, lineHeight: 1.6,
                    color: "#58a6ff", marginTop: 4,
                    opacity: interpolate(frame, [scopeStart, scopeStart + 8], [0, 1], {
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  ? {scopeQuestion}
                </div>
              )}

              {scopeAnswer && frame >= answerStart && (
                <div
                  style={{
                    fontFamily: MONO, fontSize: 18, lineHeight: 1.6, color: GREEN,
                    opacity: interpolate(frame, [answerStart, answerStart + 6], [0, 1], {
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  › {scopeAnswer}
                </div>
              )}

              {frame >= SPAWN_START && <div style={{ height: 12 }} />}

              {frame >= taskCreateStart && (
                <div
                  style={{
                    fontFamily: MONO, fontSize: 18, lineHeight: 1.6, color: "#8b949e",
                    opacity: interpolate(frame, [taskCreateStart, taskCreateStart + 8], [0, 1], {
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  <span style={{ color: primaryColor }}>TaskCreate</span>: Verify authentication flow
                </div>
              )}

              {frame >= spawnHeaderStart && (
                <div
                  style={{
                    fontFamily: MONO, fontSize: 18, lineHeight: 1.6,
                    color: FG, fontWeight: 600, marginTop: 8,
                    opacity: interpolate(frame, [spawnHeaderStart, spawnHeaderStart + 8], [0, 1], {
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  Spawning {agents.length} agents...
                </div>
              )}

              {frame >= RACE_START && (
                <div style={{ marginTop: 8 }}>
                  {agents.map((agent, i) => (
                    <AgentSpinner
                      key={agent.name}
                      name={agent.name}
                      color={agent.color}
                      statusText={agent.statusText}
                      completedText={agent.completedText}
                      completionFrame={agent.completionFrame}
                      raceStartFrame={RACE_START + i * 4}
                    />
                  ))}
                </div>
              )}

              {frame >= RESULTS_START && (
                <div style={{ marginTop: 16 }}>
                  <ResultsBlock
                    resultTitle={resultTitle}
                    score={score}
                    findings={findings}
                    advisories={advisories}
                    startFrame={RESULTS_START}
                    primaryColor={primaryColor}
                  />
                </div>
              )}
            </div>
          </div>
        </AbsoluteFill>

        {frame >= CTA_START && (
          <CTAOverlay
            ctaCommand={ctaCommand}
            ctaSubtext={ctaSubtext}
            primaryColor={primaryColor}
            startFrame={CTA_START}
          />
        )}
      </Sequence>

      <div
        style={{
          position: "absolute", bottom: 16, right: 16,
          fontFamily: MONO, fontSize: 10, color: "#30363d",
        }}
      >
        OrchestKit Demo
      </div>
    </AbsoluteFill>
  );
};

export default TerminalFlow;
