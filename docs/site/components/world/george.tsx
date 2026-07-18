// "George at the Margins": mascot micro-system.
//
// George is a heterochromatic husky. Style law:
//   - single-weight 1.5px line art, stroke = currentColor (use a muted
//     foreground text color on the consumer side)
//   - ONLY the two eyes carry color: one amber, one ice, as two 4px circles
//   - each pose is a minimal-geometric suggestion of a husky (pointed ears,
//     curled tail) in <= 10 strokes: never a detailed dog
//
// George may appear ONLY in the sanctioned slots: the 404 page (GeorgeBuried),
// error/empty states (GeorgeCurled), and one bullet/divider use of GeorgeMark.

const AMBER = "oklch(0.78 0.13 85)";
const ICE = "oklch(0.76 0.06 220)";

/**
 * The abstract two-dot mark: George reduced to his eyes.
 * 6px amber dot + 6px ice dot with a 4px gap. Pure CSS, no SVG.
 *
 * Intended placement (owning files belong to other agents, so it is not
 * wired here): the eyebrow bullet of the homepage persona cards in
 * app/(home)/page.tsx, or the docs end-of-page divider inside the DocsBody
 * in app/docs/[[...slug]]/page.tsx — for the latter, drop in
 * <GeorgeDivider /> below the MDX body.
 */
export function GeorgeMark({ className = "" }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={`inline-flex items-center gap-1 align-middle ${className}`}
		>
			<span
				className="size-1.5 rounded-full"
				style={{ backgroundColor: AMBER }}
			/>
			<span
				className="size-1.5 rounded-full"
				style={{ backgroundColor: ICE }}
			/>
		</span>
	);
}

/**
 * Ready-to-drop end-of-page divider: hairline — GeorgeMark — hairline.
 * The ONE sanctioned bullet/divider use of GeorgeMark. Server-safe; intended
 * for the bottom of DocsBody in app/docs/[[...slug]]/page.tsx (that file is
 * owned by another agent, so it is exported here rather than wired).
 */
export function GeorgeDivider({ className = "" }: { className?: string }) {
	return (
		<div
			aria-hidden
			className={`mt-12 flex items-center gap-3 ${className}`}
		>
			<span className="h-px flex-1 bg-fd-border" />
			<GeorgeMark />
			<span className="h-px flex-1 bg-fd-border" />
		</div>
	);
}

/** Shared eye pair: the only color in any pose. Two 4px (r=2) circles. */
function Eyes({ amber, ice }: { amber: [number, number]; ice: [number, number] }) {
	return (
		<>
			<circle cx={amber[0]} cy={amber[1]} r="2" fill={AMBER} stroke="none" />
			<circle cx={ice[0]} cy={ice[1]} r="2" fill={ICE} stroke="none" />
		</>
	);
}

const svgProps = {
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.5,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": true,
} as const;

/**
 * George digging: head down at a freshly dug hole, rear and curled tail up.
 * For the 404 page. 10 strokes.
 */
export function GeorgeBuried({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 64 48" width="128" height="96" className={className} {...svgProps}>
			{/* ground, interrupted by the hole */}
			<path d="M4 41h11" />
			<path d="M15 41q7 7 14 0" />
			<path d="M29 41h31" />
			{/* face line, nose into the hole */}
			<path d="M21 30L18 40" />
			{/* pointed ears */}
			<path d="M21 29l1-6 4 4" />
			<path d="M27 27l2-6 4 4" />
			{/* back, rump raised */}
			<path d="M28 26Q38 15 45 21" />
			{/* curled tail */}
			<path d="M45 21q9-8 2-12" />
			{/* hind leg + paw */}
			<path d="M45 22l2 18h4" />
			{/* flying dirt */}
			<path d="M9 33l-4-5" />
			<Eyes amber={[24, 33]} ice={[28, 31.5]} />
		</svg>
	);
}

/**
 * George curled up asleep, tail wrapped around below.
 * For error and empty states. 5 strokes.
 */
export function GeorgeCurled({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 64 48" width="128" height="96" className={className} {...svgProps}>
			{/* curled body */}
			<path d="M40 18A13 13 0 1 0 43 31" />
			{/* head resting on the body */}
			<path d="M38.8 21A6 6 0 1 1 46 29.5" />
			{/* pointed ears */}
			<path d="M41 19l1-5 4 3" />
			<path d="M47 18l3-4 2 5" />
			{/* tail wrapped around */}
			<path d="M17 33q0 10 14 10" />
			<Eyes amber={[41.5, 23.5]} ice={[45.5, 25.5]} />
		</svg>
	);
}
