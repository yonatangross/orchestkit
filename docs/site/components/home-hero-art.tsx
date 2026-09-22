import Image from "next/image";

/**
 * Conductor OG art for hero option A (design/og-card/art/A-1.png).
 * Desktop: absolute right bleed ~55% with L→R mask (see .home-hero-art in global.css).
 * Mobile ≤900px: 16:9 band under the copy column.
 */
export function HomeHeroArt() {
  return (
    <div
      className="home-hero-art"
      role="img"
      aria-label="Conductor and holographic orchestra art"
    >
      <Image
        src="/brand/hero-a-conductor.png"
        alt=""
        fill
        priority
        sizes="(max-width: 900px) 100vw, 55vw"
        className="object-cover"
      />
    </div>
  );
}
