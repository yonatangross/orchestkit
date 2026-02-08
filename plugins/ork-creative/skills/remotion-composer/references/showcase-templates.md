# Showcase-Inspired Templates

Production patterns learned from Remotion showcase projects.

## GitHub Unwrapped Style (Year in Review)

Personal stats recap with cinematic reveals.

```tsx
const YearInReview: React.FC<{
  stats: {
    commits: number;
    prs: number;
    reviews: number;
    topLanguage: string;
  };
}> = ({ stats }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Animated background */}
      <MeshGradient colors={["#8b5cf6", "#06b6d4"]} opacity={0.15} />

      {/* Scene 1: Hero stat (0-3s) */}
      <Sequence from={0} durationInFrames={90}>
        <SlideTransition direction="up" startFrame={0}>
          <CenterCard>
            <StatCounter value={stats.commits} label="Commits" size="lg" easing="bounce" />
          </CenterCard>
        </SlideTransition>
      </Sequence>

      {/* Scene 2: Secondary stats (3-6s) */}
      <Sequence from={90} durationInFrames={90}>
        <div style={{ display: "flex", justifyContent: "center", gap: 60 }}>
          <StatCounter value={stats.prs} label="PRs Merged" delay={0} />
          <StatCounter value={stats.reviews} label="Reviews" delay={10} />
        </div>
      </Sequence>

      {/* Scene 3: Language highlight (6-9s) */}
      <Sequence from={180} durationInFrames={90}>
        <ScaleTransition startFrame={0}>
          <LanguageBadge language={stats.topLanguage} />
        </ScaleTransition>
      </Sequence>

      {/* Progress bar */}
      <ProgressBar />
    </AbsoluteFill>
  );
};
```

## AnimStats Style (Data Dashboard)

Racing bars and metric cards with real-time feel.

```tsx
const DataDashboard: React.FC<{
  metrics: Array<{ label: string; value: number; trend: number }>;
  comparison: Array<{ category: string; before: number; after: number }>;
}> = ({ metrics, comparison }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      <GlowOrbs animated />

      {/* Top row: Metric cards */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 60,
          right: 60,
          display: "flex",
          gap: 24,
        }}
      >
        {metrics.map((m, i) => (
          <MetricCard
            key={i}
            value={m.value}
            label={m.label}
            trend={m.trend}
            delay={i * 15}
            color="#8b5cf6"
          />
        ))}
      </div>

      {/* Center: Racing bar chart */}
      <AbsoluteFill style={{ top: 200 }}>
        <BarChart
          data={comparison.map((c) => ({
            label: c.category,
            value: c.after,
            color: c.after > c.before ? "#22c55e" : "#ef4444",
          }))}
          staggerDelay={8}
          showValues
        />
      </AbsoluteFill>

      {/* Bottom: Comparison stats */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-around",
        }}
      >
        {comparison.slice(0, 3).map((c, i) => (
          <ComparisonStat
            key={i}
            label={c.category}
            before={c.before}
            after={c.after}
            delay={i * 20}
          />
        ))}
      </div>

      <Vignette intensity={0.4} />
    </AbsoluteFill>
  );
};
```

## Product Announcement Style

Tech reveal with feature callouts.

```tsx
const ProductAnnouncement: React.FC<{
  productName: string;
  tagline: string;
  features: string[];
  ctaText: string;
}> = ({ productName, tagline, features, ctaText }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      <ParticleBackground particleCount={40} opacity={0.4} />

      {/* Scene 1: Logo reveal (0-2s) */}
      <Sequence from={0} durationInFrames={60}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <RevealTransition type="circle" startFrame={0}>
            <GradientText
              text={productName}
              colors={["#8b5cf6", "#22c55e"]}
              fontSize={120}
              animateGradient
            />
          </RevealTransition>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Tagline (2-4s) */}
      <Sequence from={60} durationInFrames={60}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <AnimatedText
            text={tagline}
            animation="blur"
            fontSize={48}
            color="rgba(255,255,255,0.9)"
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Features list (4-8s) */}
      <Sequence from={120} durationInFrames={120}>
        <FeatureList features={features} />
      </Sequence>

      {/* Scene 4: CTA (8-10s) */}
      <Sequence from={240}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <CTAButton text={ctaText} />
        </AbsoluteFill>
      </Sequence>

      <SceneTransition type="fade" startFrame={55} durationFrames={10} />
      <SceneTransition type="wipe" startFrame={115} durationFrames={10} />
    </AbsoluteFill>
  );
};

const FeatureList: React.FC<{ features: string[] }> = ({ features }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: 80,
      }}
    >
      {features.map((feature, i) => {
        const delay = i * 20;
        const progress = spring({
          frame: frame - delay,
          fps,
          config: { damping: 15 },
        });

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: progress,
              transform: `translateX(${(1 - progress) * 50}px)`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#8b5cf6",
              }}
            />
            <span style={{ fontSize: 28, color: "white" }}>{feature}</span>
          </div>
        );
      })}
    </div>
  );
};
```

## Music Visualization Style

Audio-reactive animations.

```tsx
import { getAudioData, useAudioData, visualizeAudio } from "@remotion/media-utils";

const MusicVisualization: React.FC<{
  audioSrc: string;
}> = ({ audioSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const audioData = useAudioData(audioSrc);

  if (!audioData) {
    return null;
  }

  const visualization = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples: 64, // Frequency bands
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {/* Circular equalizer */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <svg width={600} height={600}>
          {visualization.map((amplitude, i) => {
            const angle = (i / visualization.length) * Math.PI * 2;
            const innerRadius = 100;
            const barLength = amplitude * 150;

            const x1 = 300 + Math.cos(angle) * innerRadius;
            const y1 = 300 + Math.sin(angle) * innerRadius;
            const x2 = 300 + Math.cos(angle) * (innerRadius + barLength);
            const y2 = 300 + Math.sin(angle) * (innerRadius + barLength);

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={`hsl(${270 + amplitude * 60}, 80%, 60%)`}
                strokeWidth={4}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* Waveform bars */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 60,
          right: 60,
          height: 100,
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
        }}
      >
        {visualization.map((amplitude, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${amplitude * 100}%`,
              backgroundColor: "#8b5cf6",
              borderRadius: 2,
              opacity: 0.8,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
```

## Conference Speaker Card

Speaker intro with animated elements.

```tsx
const SpeakerCard: React.FC<{
  name: string;
  title: string;
  company: string;
  avatarUrl: string;
  socialHandle: string;
}> = ({ name, title, company, avatarUrl, socialHandle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const photoScale = spring({ frame, fps, config: { damping: 12 } });
  const textOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      <MeshGradient colors={["#8b5cf6", "#06b6d4"]} opacity={0.1} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: 80,
          gap: 60,
        }}
      >
        {/* Avatar with animated border */}
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            overflow: "hidden",
            transform: `scale(${photoScale})`,
            border: "4px solid #8b5cf6",
            boxShadow: "0 0 60px rgba(139, 92, 246, 0.4)",
          }}
        >
          <Img src={avatarUrl} style={{ width: "100%", height: "100%" }} />
        </div>

        {/* Text content */}
        <div style={{ opacity: textOpacity }}>
          <h1
            style={{
              fontSize: 64,
              color: "white",
              fontWeight: 700,
              margin: 0,
            }}
          >
            {name}
          </h1>
          <p
            style={{
              fontSize: 28,
              color: "#8b5cf6",
              margin: "8px 0 0",
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontSize: 24,
              color: "rgba(255,255,255,0.7)",
              margin: "4px 0 0",
            }}
          >
            {company}
          </p>
          <p
            style={{
              fontSize: 20,
              color: "#06b6d4",
              margin: "16px 0 0",
              fontFamily: "Menlo, monospace",
            }}
          >
            @{socialHandle}
          </p>
        </div>
      </div>

      <Vignette intensity={0.3} />
    </AbsoluteFill>
  );
};
```

## Template Patterns Summary

| Template | Duration | Key Elements |
|----------|----------|--------------|
| Year in Review | 10-15s | Stats, counters, progress rings |
| Data Dashboard | 15-30s | Bar charts, metric cards, comparisons |
| Product Announce | 10-20s | Logo reveal, features, CTA |
| Music Viz | Variable | Audio-reactive, equalizer, waveforms |
| Speaker Card | 5-10s | Avatar, text reveal, social |
| Tutorial | 30-120s | Captions, code, highlights |
| Social Clip | 15-60s | Vertical, quick cuts, text overlays |

## Video Format Guidelines

| Platform | Aspect | Duration | Style |
|----------|--------|----------|-------|
| YouTube | 16:9 | 30s-5min | Detailed, polished |
| TikTok | 9:16 | 15-60s | Fast, text-heavy |
| Instagram Reels | 9:16 | 15-90s | Colorful, engaging |
| Twitter/X | 16:9/1:1 | 15-140s | Quick hook, clear message |
| LinkedIn | 16:9/1:1 | 30s-3min | Professional, informative |

## Hook Patterns (First 3 Seconds)

1. **Question Hook**: "Did you know...?"
2. **Stats Hook**: Large animated number
3. **Problem Hook**: "Tired of X?"
4. **Visual Hook**: Dramatic reveal/transition
5. **Curiosity Hook**: Incomplete reveal

```tsx
// Stats hook example
const StatsHook: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  return (
    <Sequence durationInFrames={90}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <StatCounter
          value={value}
          label={label}
          size="lg"
          easing="elastic"
          digitMorph
          celebrateOnComplete
        />
      </AbsoluteFill>
    </Sequence>
  );
};
```
