import React from "react";
import { z } from "zod";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { PaperTexture } from "./scrapbook/PaperTexture";
import { KineticText } from "./scrapbook/KineticText";
import { SocialCard } from "./scrapbook/SocialCard";
import { StatsCounter } from "./scrapbook/StatsCounter";
import { NoiseTexture, Vignette } from "./shared/BackgroundEffects";
import {
  SCRAPBOOK_PALETTE,
  SCRAPBOOK_TYPOGRAPHY,
  SCRAPBOOK_ANIMATION,
} from "../styles/scrapbook-style";

// Re-use the same schema from landscape
export const scrapbookDemoSquareSchema = z.object({
  title: z.string(),
  tagline: z.string(),
  socialCards: z
    .array(
      z.object({
        author: z.string(),
        text: z.string(),
        handle: z.string().optional(),
      })
    )
    .default([]),
  stats: z.object({
    skills: z.number(),
    agents: z.number(),
    hooks: z.number(),
  }),
  ctaCommand: z.string(),
  accentColor: z.string().optional(),
});

type ScrapbookSquareProps = z.infer<typeof scrapbookDemoSquareSchema>;

// Scene durations adjusted for square (slightly shorter)
const SCENE_DURATIONS = {
  title: 75,     // 2.5s
  social: 120,   // 4s
  stats: 60,     // 2s
  cta: 75,       // 2.5s
};

export const ScrapbookDemoSquare: React.FC<ScrapbookSquareProps> = ({
  title,
  tagline,
  socialCards,
  stats,
  ctaCommand,
  accentColor,
}) => {
  const accent = accentColor ?? SCRAPBOOK_PALETTE.accents[1];

  let offset = 0;

  return (
    <AbsoluteFill>
      <PaperTexture />

      {/* Title */}
      <Sequence from={offset} durationInFrames={SCENE_DURATIONS.title}>
        <TitleSceneSquare title={title} tagline={tagline} />
      </Sequence>
      {(offset += SCENE_DURATIONS.title)}

      {/* Social cards (show max 2 for square) */}
      {socialCards.length > 0 && (
        <Sequence from={offset} durationInFrames={SCENE_DURATIONS.social}>
          <SocialSceneSquare cards={socialCards.slice(0, 2)} />
        </Sequence>
      )}
      {socialCards.length > 0 && (offset += SCENE_DURATIONS.social)}

      {/* Stats */}
      <Sequence from={offset} durationInFrames={SCENE_DURATIONS.stats}>
        <StatsSceneSquare stats={stats} />
      </Sequence>
      {(offset += SCENE_DURATIONS.stats)}

      {/* CTA */}
      <Sequence from={offset} durationInFrames={SCENE_DURATIONS.cta}>
        <CTASceneSquare command={ctaCommand} accentColor={accent} />
      </Sequence>

      <NoiseTexture opacity={SCRAPBOOK_ANIMATION.grainOpacity} />
      <Vignette intensity={SCRAPBOOK_ANIMATION.vignetteIntensity} color="#B4AA96" />
    </AbsoluteFill>
  );
};

// ---------- Square Scene Components ----------

const TitleSceneSquare: React.FC<{ title: string; tagline: string }> = ({
  title,
  tagline,
}) => {
  const frame = useCurrentFrame();

  const taglineOpacity = interpolate(frame - 10, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", padding: 60 }}
    >
      <div style={{ textAlign: "center" }}>
        <KineticText text={title} mode="headline" fontSize={72} />
        <div
          style={{
            marginTop: 20,
            opacity: taglineOpacity,
            fontSize: 24,
            fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
            color: SCRAPBOOK_PALETTE.text.muted,
          }}
        >
          {tagline}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SocialSceneSquare: React.FC<{
  cards: ScrapbookSquareProps["socialCards"];
}> = ({ cards }) => {
  const directions: Array<"left" | "right"> = ["left", "right"];
  const tilts = [-1.5, 1.5];

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
        gap: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxWidth: 900,
        }}
      >
        {cards.map((card, i) => (
          <SocialCard
            key={i}
            author={card.author}
            text={card.text}
            handle={card.handle}
            delay={i * 10}
            direction={directions[i % 2]}
            tilt={tilts[i % 2]}
            accentColor={
              SCRAPBOOK_PALETTE.accents[i % SCRAPBOOK_PALETTE.accents.length]
            }
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const StatsSceneSquare: React.FC<{
  stats: ScrapbookSquareProps["stats"];
}> = ({ stats }) => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
    <StatsCounter
      stats={[
        { value: stats.skills, label: "skills" },
        { value: stats.agents, label: "agents" },
        { value: stats.hooks, label: "hooks" },
      ]}
      staggerMs={100}
    />
  </AbsoluteFill>
);

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
        Get started
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
