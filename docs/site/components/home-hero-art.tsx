import Image from "next/image";

/**
 * Conductor OG art for hero option A (design/og-card/art/A-1.png).
 * Desktop: an in-flow grid item in column 2, never absolute (see
 * .home-hero-art in global.css). Dark bleeds to the viewport edge with
 * feathered inner edges; light is a framed card.
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
