// The hero proof strip (approved mockup: strip and table, Yonatan 16.11.2026 09:28): stars,
// MIT and free, and every host OrchestKit runs in, linking to the compatibility table. Host names
// and order come from HOST_INSTALLS, so a host added there shows here too.
import { StarLink } from "@/app/(home)/star-link";
import { HOST_INSTALLS } from "@/lib/host-installs";

export function HeroStrip({ stars }: { stars: number | null }) {
	return (
		// Spacing, not divider glyphs: a divider in a wrapping row ends a line on its own at 390.
		<div className="mt-6 flex flex-wrap items-center justify-start gap-x-6 gap-y-1.5 font-mono text-[12px] text-fd-muted-foreground min-[901px]:justify-center">
			<StarLink stars={stars} />
			<span className="inline-flex items-center gap-1.5">MIT, free, no account</span>
			<a
				href="/docs/compatibility"
				className="inline-flex min-h-11 items-center gap-1.5 underline-offset-2 hover:text-fd-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-primary"
			>
				Works in {HOST_INSTALLS.length} agents: {HOST_INSTALLS.map((h) => h.name).join(" · ")} →
			</a>
		</div>
	);
}
