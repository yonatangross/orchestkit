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

export const releaseNotesSchema = z.object({
  version: z.string(),
  date: z.string(),
  highlights: z.array(highlightSchema).min(1).max(6),
  statsBefore: statsSchema,
  statsAfter: statsSchema,
  ctaCommand: z.string(),
  accentColor: z.string().optional(),
});

type ReleaseNotesProps = z.infer<typeof releaseNotesSchema>;
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

// ---------- Scene Components ----------

const VersionTitleScene: React.FC<{ version: string; date: string }> = ({
  version,
  date,
}) => {
  const frame = useCurrentFrame();

  const dateOpacity = interpolate(frame - 15, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lineWidth = interpolate(frame - 8, [0, 15], [0, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", padding: 80 }}
    >
      <div style={{ textAlign: "center" }}>
        <KineticText
          text={`OrchestKit ${version}`}
          mode="headline"
          fontSize={88}
        />
        {/* Accent underline */}
        <div
          style={{
            width: lineWidth,
            height: 4,
            backgroundColor: SCRAPBOOK_PALETTE.accents[1],
            borderRadius: 2,
            margin: "16px auto",
          }}
        />
        <div
          style={{
            opacity: dateOpacity,
            fontSize: SCRAPBOOK_TYPOGRAPHY.sizes.body,
            fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
            color: SCRAPBOOK_PALETTE.text.muted,
            fontWeight: 400,
          }}
        >
          {date}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ChangeCard: React.FC<{
  highlight: Highlight;
  delay: number;
  index: number;
}> = ({ highlight, delay, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  const slideY = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 16, stiffness: 200, mass: 1 },
    from: 40,
    to: 0,
  });

  const opacity = interpolate(adjustedFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const categoryColor = CATEGORY_COLORS[highlight.category];
  const tilt = index % 2 === 0 ? -0.8 : 0.8;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${slideY}px) rotate(${tilt}deg)`,
        backgroundColor: SCRAPBOOK_PALETTE.background.secondary,
        border: `1px solid ${SCRAPBOOK_PALETTE.ui.border}`,
        borderRadius: 12,
        padding: "20px 28px",
        maxWidth: 520,
        boxShadow: `0 3px 12px ${SCRAPBOOK_PALETTE.ui.shadow}`,
      }}
    >
      {/* Category badge */}
      <div
        style={{
          display: "inline-block",
          backgroundColor: `${categoryColor}18`,
          border: `1px solid ${categoryColor}40`,
          borderRadius: 6,
          padding: "4px 12px",
          marginBottom: 10,
          fontSize: 14,
          fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
          fontWeight: 600,
          color: categoryColor,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {CATEGORY_LABELS[highlight.category]}
      </div>
      {/* Title */}
      <div
        style={{
          fontSize: 22,
          fontFamily: SCRAPBOOK_TYPOGRAPHY.serif,
          fontWeight: 700,
          color: SCRAPBOOK_PALETTE.text.heading,
          lineHeight: 1.3,
          marginBottom: 6,
        }}
      >
        {highlight.title}
      </div>
      {/* Description */}
      <div
        style={{
          fontSize: 16,
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

const HighlightsScene: React.FC<{ highlights: Highlight[] }> = ({
  highlights,
}) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 24,
          maxWidth: 1200,
        }}
      >
        {highlights.map((h, i) => (
          <ChangeCard key={i} highlight={h} delay={i * 8} index={i} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const StatsDeltaScene: React.FC<{
  before: ReleaseNotesProps["statsBefore"];
  after: ReleaseNotesProps["statsAfter"];
}> = ({ before, after }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = [
    { label: "skills", prev: before.skills, next: after.skills, accent: SCRAPBOOK_PALETTE.accents[0] },
    { label: "agents", prev: before.agents, next: after.agents, accent: SCRAPBOOK_PALETTE.accents[1] },
    { label: "hooks", prev: before.hooks, next: after.hooks, accent: SCRAPBOOK_PALETTE.accents[2] },
  ];

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center" }}
    >
      <div style={{ display: "flex", gap: 80, alignItems: "flex-start" }}>
        {items.map((item, i) => {
          const delay = i * 6;
          const adj = Math.max(0, frame - delay);

          const entryScale = spring({
            frame: adj,
            fps,
            config: SCRAPBOOK_ANIMATION.stampSpring,
          });

          const countProgress = interpolate(adj, [0, 30], [0, 1], {
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.ease),
          });

          const displayValue = Math.round(
            item.prev + (item.next - item.prev) * countProgress
          );

          const delta = item.next - item.prev;
          const deltaOpacity = interpolate(adj - 25, [0, 8], [0, 1], {
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
                gap: 6,
              }}
            >
              {/* Number */}
              <div
                style={{
                  fontSize: SCRAPBOOK_TYPOGRAPHY.sizes.hero,
                  fontWeight: 700,
                  fontFamily: SCRAPBOOK_TYPOGRAPHY.serif,
                  color: SCRAPBOOK_PALETTE.text.heading,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {displayValue}
              </div>

              {/* Delta badge */}
              {delta !== 0 && (
                <div
                  style={{
                    opacity: deltaOpacity,
                    fontSize: 18,
                    fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
                    fontWeight: 600,
                    color: delta > 0 ? "#2E7D32" : "#C62828",
                  }}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </div>
              )}

              {/* Accent underline */}
              <div
                style={{
                  width: 48,
                  height: 3,
                  backgroundColor: item.accent,
                  borderRadius: 2,
                  transform: `scaleX(${countProgress})`,
                  transformOrigin: "center",
                }}
              />

              {/* Label */}
              <div
                style={{
                  fontSize: SCRAPBOOK_TYPOGRAPHY.sizes.body,
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

const UpgradeCTAScene: React.FC<{
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
      style={{ justifyContent: "center", alignItems: "center", gap: 30 }}
    >
      <div
        style={{
          fontSize: SCRAPBOOK_TYPOGRAPHY.sizes.heading,
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
          borderRadius: 12,
          padding: "18px 48px",
          fontSize: 28,
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

const SCENE_DURATIONS = {
  title: 90,       // 3s
  highlights: 150, // 5s
  statsDelta: 90,  // 3s
  cta: 90,         // 3s
};

export const ReleaseNotes: React.FC<ReleaseNotesProps> = ({
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
  const scenes: Array<{ type: string; from: number; duration: number }> = [];

  scenes.push({ type: "title", from: offset, duration: SCENE_DURATIONS.title });
  offset += SCENE_DURATIONS.title;

  scenes.push({ type: "highlights", from: offset, duration: SCENE_DURATIONS.highlights });
  offset += SCENE_DURATIONS.highlights;

  scenes.push({ type: "statsDelta", from: offset, duration: SCENE_DURATIONS.statsDelta });
  offset += SCENE_DURATIONS.statsDelta;

  scenes.push({ type: "cta", from: offset, duration: SCENE_DURATIONS.cta });

  return (
    <AbsoluteFill>
      <PaperTexture />

      {scenes.map((scene, i) => (
        <Sequence key={i} from={scene.from} durationInFrames={scene.duration}>
          {scene.type === "title" && (
            <VersionTitleScene version={version} date={date} />
          )}
          {scene.type === "highlights" && (
            <HighlightsScene highlights={highlights} />
          )}
          {scene.type === "statsDelta" && (
            <StatsDeltaScene before={statsBefore} after={statsAfter} />
          )}
          {scene.type === "cta" && (
            <UpgradeCTAScene command={ctaCommand} accentColor={accent} />
          )}
        </Sequence>
      ))}

      <NoiseTexture opacity={SCRAPBOOK_ANIMATION.grainOpacity} />
      <Vignette
        intensity={SCRAPBOOK_ANIMATION.vignetteIntensity}
        color="#B4AA96"
      />
    </AbsoluteFill>
  );
};
