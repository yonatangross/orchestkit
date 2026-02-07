import React from "react";
import { z } from "zod";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { PaperTexture } from "./scrapbook/PaperTexture";
import { KineticText } from "./scrapbook/KineticText";
import { NoiseTexture, Vignette } from "./shared/BackgroundEffects";
import {
  SCRAPBOOK_PALETTE,
  SCRAPBOOK_TYPOGRAPHY,
  SCRAPBOOK_ANIMATION,
} from "../styles/scrapbook-style";

// ---------- Schema ----------

const highlightSchema = z.object({
  category: z.enum(["added", "changed", "fixed"]),
  title: z.string(),
  description: z.string(),
});

const statsSchema = z.object({
  skills: z.number(),
  agents: z.number(),
  hooks: z.number(),
});

export const releaseNotesSquareSchema = z.object({
  version: z.string(),
  date: z.string(),
  highlights: z.array(highlightSchema).min(1).max(4),
  statsBefore: statsSchema,
  statsAfter: statsSchema,
  ctaCommand: z.string(),
  accentColor: z.string().optional(),
});

type ReleaseNotesSquareProps = z.infer<typeof releaseNotesSquareSchema>;
type Highlight = z.infer<typeof highlightSchema>;

// ---------- Category Colors ----------

const CATEGORY_COLORS = {
  added: "#2E7D32",
  changed: "#1565C0",
  fixed: "#C62828",
} as const;

const CATEGORY_LABELS = {
  added: "Added",
  changed: "Changed",
  fixed: "Fixed",
} as const;

// ---------- Scene Durations (shorter for square) ----------

const SCENE_DURATIONS = {
  title: 75,       // 2.5s
  highlights: 120, // 4s
  statsDelta: 75,  // 2.5s
  cta: 75,         // 2.5s
};

// ---------- Scene Components ----------

const TitleSceneSquare: React.FC<{ version: string; date: string }> = ({
  version,
  date,
}) => {
  const frame = useCurrentFrame();

  const dateOpacity = interpolate(frame - 12, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lineWidth = interpolate(frame - 6, [0, 12], [0, 80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", padding: 60 }}
    >
      <div style={{ textAlign: "center" }}>
        <KineticText
          text={`OrchestKit ${version}`}
          mode="headline"
          fontSize={64}
        />
        <div
          style={{
            width: lineWidth,
            height: 3,
            backgroundColor: SCRAPBOOK_PALETTE.accents[1],
            borderRadius: 2,
            margin: "12px auto",
          }}
        />
        <div
          style={{
            opacity: dateOpacity,
            fontSize: 20,
            fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
            color: SCRAPBOOK_PALETTE.text.muted,
          }}
        >
          {date}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ChangeCardSquare: React.FC<{
  highlight: Highlight;
  delay: number;
  index: number;
}> = ({ highlight, delay, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adj = Math.max(0, frame - delay);

  const slideY = spring({
    frame: adj,
    fps,
    config: { damping: 16, stiffness: 200, mass: 1 },
    from: 30,
    to: 0,
  });

  const opacity = interpolate(adj, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const categoryColor = CATEGORY_COLORS[highlight.category];
  const tilt = index % 2 === 0 ? -0.6 : 0.6;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${slideY}px) rotate(${tilt}deg)`,
        backgroundColor: SCRAPBOOK_PALETTE.background.secondary,
        border: `1px solid ${SCRAPBOOK_PALETTE.ui.border}`,
        borderRadius: 10,
        padding: "16px 22px",
        boxShadow: `0 2px 8px ${SCRAPBOOK_PALETTE.ui.shadow}`,
      }}
    >
      <div
        style={{
          display: "inline-block",
          backgroundColor: `${categoryColor}18`,
          border: `1px solid ${categoryColor}40`,
          borderRadius: 5,
          padding: "3px 10px",
          marginBottom: 8,
          fontSize: 12,
          fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
          fontWeight: 600,
          color: categoryColor,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {CATEGORY_LABELS[highlight.category]}
      </div>
      <div
        style={{
          fontSize: 18,
          fontFamily: SCRAPBOOK_TYPOGRAPHY.serif,
          fontWeight: 700,
          color: SCRAPBOOK_PALETTE.text.heading,
          lineHeight: 1.3,
          marginBottom: 4,
        }}
      >
        {highlight.title}
      </div>
      <div
        style={{
          fontSize: 14,
          fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
          color: SCRAPBOOK_PALETTE.text.muted,
          lineHeight: 1.4,
        }}
      >
        {highlight.description}
      </div>
    </div>
  );
};

const HighlightsSceneSquare: React.FC<{ highlights: Highlight[] }> = ({
  highlights,
}) => {
  // Max 3 highlights for square
  const shown = highlights.slice(0, 3);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxWidth: 900,
        }}
      >
        {shown.map((h, i) => (
          <ChangeCardSquare key={i} highlight={h} delay={i * 8} index={i} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const StatsDeltaSceneSquare: React.FC<{
  before: ReleaseNotesSquareProps["statsBefore"];
  after: ReleaseNotesSquareProps["statsAfter"];
}> = ({ before, after }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    { label: "skills", prev: before.skills, next: after.skills, accent: SCRAPBOOK_PALETTE.accents[0] },
    { label: "agents", prev: before.agents, next: after.agents, accent: SCRAPBOOK_PALETTE.accents[1] },
    { label: "hooks", prev: before.hooks, next: after.hooks, accent: SCRAPBOOK_PALETTE.accents[2] },
  ];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 60, alignItems: "flex-start" }}>
        {items.map((item, i) => {
          const delay = i * 6;
          const adj = Math.max(0, frame - delay);

          const entryScale = spring({
            frame: adj,
            fps,
            config: SCRAPBOOK_ANIMATION.stampSpring,
          });

          const countProgress = interpolate(adj, [0, 25], [0, 1], {
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.ease),
          });

          const displayValue = Math.round(
            item.prev + (item.next - item.prev) * countProgress
          );

          const delta = item.next - item.prev;
          const deltaOpacity = interpolate(adj - 20, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                transform: `scale(${entryScale})`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  fontFamily: SCRAPBOOK_TYPOGRAPHY.serif,
                  color: SCRAPBOOK_PALETTE.text.heading,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {displayValue}
              </div>
              {delta !== 0 && (
                <div
                  style={{
                    opacity: deltaOpacity,
                    fontSize: 16,
                    fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
                    fontWeight: 600,
                    color: delta > 0 ? "#2E7D32" : "#C62828",
                  }}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </div>
              )}
              <div
                style={{
                  width: 36,
                  height: 3,
                  backgroundColor: item.accent,
                  borderRadius: 2,
                  transform: `scaleX(${countProgress})`,
                  transformOrigin: "center",
                }}
              />
              <div
                style={{
                  fontSize: 20,
                  fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
                  color: SCRAPBOOK_PALETTE.text.muted,
                  textTransform: "lowercase",
                  letterSpacing: "0.04em",
                }}
              >
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const CTASceneSquare: React.FC<{
  command: string;
  accentColor: string;
}> = ({ command, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = 1 + Math.sin(frame * 0.15) * 0.02;
  const scale = spring({
    frame,
    fps,
    config: SCRAPBOOK_ANIMATION.stampSpring,
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", gap: 24 }}
    >
      <div
        style={{
          fontSize: 36,
          fontFamily: SCRAPBOOK_TYPOGRAPHY.serif,
          color: SCRAPBOOK_PALETTE.text.heading,
          fontWeight: 700,
          transform: `scale(${scale})`,
        }}
      >
        Update now
      </div>
      <div
        style={{
          transform: `scale(${scale * pulse})`,
          backgroundColor: SCRAPBOOK_PALETTE.background.paper,
          border: `2px solid ${accentColor}`,
          borderRadius: 10,
          padding: "14px 36px",
          fontSize: 24,
          fontFamily: "Menlo, monospace",
          color: SCRAPBOOK_PALETTE.text.heading,
          fontWeight: 600,
          boxShadow: `0 4px 20px ${accentColor}30`,
        }}
      >
        {command}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Main Composition ----------

export const ReleaseNotesSquare: React.FC<ReleaseNotesSquareProps> = ({
  version,
  date,
  highlights,
  statsBefore,
  statsAfter,
  ctaCommand,
  accentColor,
}) => {
  const accent = accentColor ?? SCRAPBOOK_PALETTE.accents[1];

  let offset = 0;

  return (
    <AbsoluteFill>
      <PaperTexture />

      <Sequence from={offset} durationInFrames={SCENE_DURATIONS.title}>
        <TitleSceneSquare version={version} date={date} />
      </Sequence>
      {(offset += SCENE_DURATIONS.title)}

      <Sequence from={offset} durationInFrames={SCENE_DURATIONS.highlights}>
        <HighlightsSceneSquare highlights={highlights} />
      </Sequence>
      {(offset += SCENE_DURATIONS.highlights)}

      <Sequence from={offset} durationInFrames={SCENE_DURATIONS.statsDelta}>
        <StatsDeltaSceneSquare
          before={statsBefore}
          after={statsAfter}
        />
      </Sequence>
      {(offset += SCENE_DURATIONS.statsDelta)}

      <Sequence from={offset} durationInFrames={SCENE_DURATIONS.cta}>
        <CTASceneSquare command={ctaCommand} accentColor={accent} />
      </Sequence>

      <NoiseTexture opacity={SCRAPBOOK_ANIMATION.grainOpacity} />
      <Vignette
        intensity={SCRAPBOOK_ANIMATION.vignetteIntensity}
        color="#B4AA96"
      />
    </AbsoluteFill>
  );
};
