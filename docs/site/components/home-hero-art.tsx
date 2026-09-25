import Image from "next/image";

/**
 * Conductor art for hero option A, one image per theme, stacked.
 * Dark: design/og-card/art/A-1.png. Light: a GPT Image 2 restyle of it
 * (operator pick v1, 2026-09-25). Both are cropped to the subject: the
 * source's left 44% was pure black, which pushed the conductor ~490px away
 * from the headline on wide screens.
 * Desktop: an in-flow grid item in column 2, never absolute (see
 * .home-hero-art in global.css), feathered at the edges in both themes.
 * The theme switch crossfades the two layers (.home-hero-art-layer).
 * Mobile ≤900px: 16:9 band under the headline.
 */
export function HomeHeroArt() {
  return (
    <div
      className="home-hero-art"
      role="img"
      aria-label="Conductor and holographic orchestra art"
    >
      <Image
        src="/brand/hero-conductor-dark.png"
        alt=""
        fill
        priority
        sizes="(max-width: 900px) 100vw, 50vw"
        className="home-hero-art-layer home-hero-art-dark object-cover"
      />
      <Image
        src="/brand/hero-conductor-light.jpg"
        alt=""
        fill
        loading="eager"
        sizes="(max-width: 900px) 100vw, 50vw"
        className="home-hero-art-layer home-hero-art-light object-cover"
      />
    </div>
  );
}
