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
import { CollageFrame } from "./scrapbook/CollageFrame";
import { StatsCounter } from "./scrapbook/StatsCounter";
import { NoiseTexture, Vignette } from "./shared/BackgroundEffects";
import {
  SCRAPBOOK_PALETTE,
  SCRAPBOOK_TYPOGRAPHY,
  SCRAPBOOK_ANIMATION,
} from "../styles/scrapbook-style";

// ---------- Schema ----------

const socialCardSchema = z.object({
  author: z.string(),
  text: z.string(),
  handle: z.string().optional(),
});

export const scrapbookDemoSchema = z.object({
  title: z.string(),
  tagline: z.string(),
  socialCards: z.array(socialCardSchema).default([]),
  terminalContent: z.string().optional(),
  stats: z.object({
    skills: z.number(),
    agents: z.number(),
    hooks: z.number(),
  }),
  ctaCommand: z.string(),
  accentColor: z.string().optional(),
});

type ScrapbookDemoProps = z.infer<typeof scrapbookDemoSchema>;

// ---------- Scene Components ----------

const TitleScene: React.FC<{ title: string; tagline: string }> = ({
  title,
  tagline,
}) => {
  const frame = useCurrentFrame();

  const taglineDelay = 12;
  const taglineOpacity = interpolate(frame - taglineDelay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <KineticText text={title} mode="headline" fontSize={96} />
        <div
          style={{
            marginTop: 24,
            opacity: taglineOpacity,
            fontSize: SCRAPBOOK_TYPOGRAPHY.sizes.subheading,
            fontFamily: SCRAPBOOK_TYPOGRAPHY.sans,
            color: SCRAPBOOK_PALETTE.text.muted,
            fontWeight: 400,
          }}
        >
          {tagline}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SocialScene: React.FC<{ cards: ScrapbookDemoProps["socialCards"] }> = ({
  cards,
}) => {
  const directions: Array<"left" | "right" | "top" | "bottom"> = [
    "left",
    "right",
    "bottom",
    "top",
  ];
  const tilts = [-2, 1.5, -1, 2.5];

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
        gap: 30,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 30,
          maxWidth: 1200,
        }}
      >
        {cards.map((card, i) => (
          <SocialCard
            key={i}
            author={card.author}
            text={card.text}
            handle={card.handle}
            delay={i * 8}
            direction={directions[i % directions.length]}
            tilt={tilts[i % tilts.length]}
            accentColor={
              SCRAPBOOK_PALETTE.accents[i % SCRAPBOOK_PALETTE.accents.length]
            }
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const TerminalScene: React.FC<{ content?: string }> = ({ content }) => {
  if (!content) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <CollageFrame rotation={-1.5} width={1000}>
        <div
          style={{
            backgroundColor: "#1a1a2e",
            borderRadius: 6,
            padding: 24,
            fontFamily: "Menlo, monospace",
            fontSize: 16,
            color: "#e2e8f0",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {content}
        </div>
      </CollageFrame>
    </AbsoluteFill>
  );
};

const StatsScene: React.FC<{
  stats: ScrapbookDemoProps["stats"];
}> = ({ stats }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <StatsCounter
        stats={[
          { value: stats.skills, label: "skills", accentColor: SCRAPBOOK_PALETTE.accents[0] },
          { value: stats.agents, label: "agents", accentColor: SCRAPBOOK_PALETTE.accents[1] },
          { value: stats.hooks, label: "hooks", accentColor: SCRAPBOOK_PALETTE.accents[2] },
        ]}
        staggerMs={100}
      />
    </AbsoluteFill>
  );
};

const CTAScene: React.FC<{ command: string; accentColor: string }> = ({
  command,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulse animation for CTA
  const pulse = 1 + Math.sin(frame * 0.15) * 0.02;

  const scale = spring({
    frame,
    fps,
    config: SCRAPBOOK_ANIMATION.stampSpring,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap: 30,
      }}
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
        Get started
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

// Scene durations (frames at 30fps)
const SCENE_DURATIONS = {
  title: 90,     // 3s
  social: 135,   // 4.5s
  terminal: 120, // 4s
  stats: 60,     // 2s
  cta: 90,       // 3s
};

export const ScrapbookDemo: React.FC<ScrapbookDemoProps> = ({
  title,
  tagline,
  socialCards,
  terminalContent,
  stats,
  ctaCommand,
  accentColor,
}) => {
  const accent = accentColor ?? SCRAPBOOK_PALETTE.accents[1];

  // Build scene timeline
  let offset = 0;
  const scenes: Array<{ type: string; from: number; duration: number }> = [];

  scenes.push({ type: "title", from: offset, duration: SCENE_DURATIONS.title });
  offset += SCENE_DURATIONS.title;

  if (socialCards.length > 0) {
    scenes.push({ type: "social", from: offset, duration: SCENE_DURATIONS.social });
    offset += SCENE_DURATIONS.social;
  }

  if (terminalContent) {
    scenes.push({ type: "terminal", from: offset, duration: SCENE_DURATIONS.terminal });
    offset += SCENE_DURATIONS.terminal;
  }

  scenes.push({ type: "stats", from: offset, duration: SCENE_DURATIONS.stats });
  offset += SCENE_DURATIONS.stats;

  scenes.push({ type: "cta", from: offset, duration: SCENE_DURATIONS.cta });

  return (
    <AbsoluteFill>
      {/* Paper background layer */}
      <PaperTexture />

      {/* Scene sequences */}
      {scenes.map((scene, i) => (
        <Sequence key={i} from={scene.from} durationInFrames={scene.duration}>
          {scene.type === "title" && (
            <TitleScene title={title} tagline={tagline} />
          )}
          {scene.type === "social" && <SocialScene cards={socialCards} />}
          {scene.type === "terminal" && (
            <TerminalScene content={terminalContent} />
          )}
          {scene.type === "stats" && <StatsScene stats={stats} />}
          {scene.type === "cta" && (
            <CTAScene command={ctaCommand} accentColor={accent} />
          )}
        </Sequence>
      ))}

      {/* Grain overlay */}
      <NoiseTexture opacity={SCRAPBOOK_ANIMATION.grainOpacity} />

      {/* Warm vignette */}
      <Vignette
        intensity={SCRAPBOOK_ANIMATION.vignetteIntensity}
        color="#B4AA96"
      />
    </AbsoluteFill>
  );
};
